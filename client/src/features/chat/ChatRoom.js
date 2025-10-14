// client/src/features/chat/ChatRoom.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from '../../api/axiosInstance';
import { useParams } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const SCROLL_THRESHOLD = 16; // 바닥 판정 여유(px)

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  "http://localhost:4000";

const toAbs = (u) => {
  if (!u) return "";
  return /^https?:\/\//.test(u) ? u : `${API_BASE.replace(/\/$/, "")}${u}`;
};

export default function ChatRoom({ roomIdOverride, embed = false, roomMeta, onRead }) {

  const params = useParams();
  const roomId = roomIdOverride ?? params.id;   // <- 우선순위
  const pickTs = (m) => m?.sent_at || m?.created_at || null;
  const toDate = (mOrIso) => {
    const iso = typeof mOrIso === 'string' ? mOrIso : pickTs(mOrIso);
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d : null;
  };
  const formatDateKR = (mOrIso) => {
    const d = toDate(mOrIso);
    return d ? d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  };

  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  // 스크롤/배너
  const listRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showNewMsgBanner, setShowNewMsgBanner] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // 폴링 커서/상태
  const sinceRef = useRef(null);
  const pollTimerRef = useRef(null);
  const isFetchingRef = useRef(false); // 중복 fetch 방지
  const scrollTickingRef = useRef(false); // rAF 스로틀

  const token = localStorage.getItem('token');
  let meId = null;
  if (token) {
    try { meId = jwtDecode(token)?.id || null; } catch { meId = null; }
  }  
  const isOtherInactive = !!(roomMeta && roomMeta.other_active === 0);
  const avatar = toAbs(roomMeta?.other_avatar_url);
  const initial = roomMeta?.other_nickname?.slice(0,1)?.toUpperCase() || '#';

  // -------- 스크롤 유틸 --------
  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const computeIsAtBottom = (el) =>
    el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD;

  const updateIsAtBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = computeIsAtBottom(el);
    setIsAtBottom(atBottom);
    if (atBottom && showNewMsgBanner) {
      setShowNewMsgBanner(false);
      setUnreadCount(0);
    }
  }, [showNewMsgBanner]);

  // -------- 병합/정렬 --------
  const mergeMessages = useCallback((prev, incoming) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return { merged: prev, added: 0 };

    const map = new Map(prev.map((m) => [m.id, m]));
    for (const m of incoming) {
      if (!map.has(m.id)) map.set(m.id, m);
    }
    const merged = Array.from(map.values());

    merged.sort((a, b) => {
      const ta = toDate(a)?.getTime() ?? 0;
      const tb = toDate(b)?.getTime() ?? 0;
      if (ta !== tb) return ta - tb;
      return (a.id || 0) - (b.id || 0);
    });
    const added = merged.length - prev.length;

    const last = merged[merged.length - 1];
    const lastIso = pickTs(last);
    if (lastIso) sinceRef.current = lastIso;

    return { merged, added };
  }, []);

  // -------- 메시지 불러오기(증분) --------
  const fetchMsgs = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const url = sinceRef.current
        ? `/api/chats/rooms/${roomId}/messages?after=${encodeURIComponent(sinceRef.current)}`
        : `/api/chats/rooms/${roomId}/messages`;

      const res = await axios.get(url);

      const el = listRef.current;
      const prevTop = el ? el.scrollTop : 0;
      

      setMsgs((prev) => {
        const { merged, added } = mergeMessages(prev, res.data);

        if (added === 0) {
          // 추가 없음 → 리렌더/깜빡임 방지
          return prev;
        }

        // 스크롤 유지/배너 처리
        if (el) {
          const atBottomNow = computeIsAtBottom(el);
          if (atBottomNow) {
            requestAnimationFrame(scrollToBottom);
            setShowNewMsgBanner(false);
            setUnreadCount(0);
          } else {
            setShowNewMsgBanner(true);
            setUnreadCount((n) => n + added);
            requestAnimationFrame(() => { el.scrollTop = prevTop; });
          }
        }



        return merged;
      });
    } catch (err) {
      console.error('메시지 로드 실패:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [roomId, mergeMessages, scrollToBottom]);
  
  
  // -------- 최초 로드 + 폴링 --------
  useEffect(() => {
    setMsgs([]);
    sinceRef.current = null;
    setShowNewMsgBanner(false);
    setUnreadCount(0);

    fetchMsgs(); // 최초 즉시
    pollTimerRef.current = setInterval(fetchMsgs, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      isFetchingRef.current = false;
    };
  }, [roomId, fetchMsgs]);

  // -------- 스크롤 리스너 (rAF 스로틀) --------
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onScroll = () => {
      if (scrollTickingRef.current) return;
      scrollTickingRef.current = true;
      requestAnimationFrame(() => {
        updateIsAtBottom();
        scrollTickingRef.current = false;
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    updateIsAtBottom(); // 최초 판정

    return () => el.removeEventListener('scroll', onScroll);
  }, [updateIsAtBottom]);

  // -------- 전송 --------
  const send = async () => {
    const content = text.trim();
    if (!content || isOtherInactive) return;

    try {
      const res = await axios.post(`/api/chats/rooms/${roomId}/messages`, { content });

      setMsgs((prev) => {
        const { merged, added } = mergeMessages(prev, [res.data]);
        // 내가 보낸 건 바로 바닥 고정 + 배너 해제
        requestAnimationFrame(scrollToBottom);
        setShowNewMsgBanner(false);
        setUnreadCount(0);
        // (added가 0일 순 없지만 방어)
        if (!added) return prev;
        return merged;
      });

      setText('');
    } catch (err) {
      console.error('메시지 전송 실패:', err);
      alert('메시지 전송에 실패했습니다.');
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // -------- 읽음 표시 --------
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      try {
        await axios.put(`/api/chats/rooms/${roomId}/read`);
        onRead?.(roomId); // ← 사이드바 뱃지 0으로 즉시 반영
      } catch {}
    })();
  }, [roomId, msgs.length, onRead]);

  // -------- 배너 클릭 --------
  const onBannerClick = () => {
    scrollToBottom();
    setShowNewMsgBanner(false);
    setUnreadCount(0);
  };

  return (
    <div className={embed
      ? "h-full flex flex-col bg-white"
      : "max-w-2xl mx-auto h-[80vh] flex flex-col border rounded shadow bg-white"
    }>
      {/* 헤더: 상대 프로필 + 이름(닉네임 · 제목) + 지역·스타일 */}
      <div className="px-4 py-3 border-b bg-green-50/60 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-green-500/10 overflow-hidden flex items-center justify-center">
          {avatar
            ? <img src={toAbs(avatar)} alt="상대 프로필" className="w-full h-full object-cover" />
            : <span className="text-green-700 font-semibold text-sm">{initial}</span>}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-green-700 truncate">
            {roomMeta?.other_nickname || `채팅방 #${roomId}`}
            {roomMeta?.post_title && <span className="ml-2 text-gray-500">· {roomMeta.post_title}</span>}
          </div>
          {(roomMeta?.post_location || roomMeta?.post_style) && (
            <div className="text-xs text-gray-400 truncate">
              {[roomMeta?.post_location, roomMeta?.post_style].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* 메시지 리스트 */}
      <div
        ref={listRef}
        className="chat-scroll-box flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50"
        style={{
          scrollBehavior: 'auto',       // 전역 smooth 차단
          overflowAnchor: 'none',       // ✅ 스크롤 앵커링 비활성화(점프 방지)
          contain: 'layout paint size', // 레이아웃 격리로 변동 영향 최소화
        }}
      >
        {loading && msgs.length === 0 ? (
          <>
            <div className="h-10 w-2/3 bg-gray-100 animate-pulse rounded" />
            <div className="h-10 w-1/2 bg-gray-100 animate-pulse rounded" />
            <div className="h-10 w-3/4 bg-gray-100 animate-pulse rounded" />
          </>
        ) : (
          msgs.map((m, idx) => {
            const mine = meId && Number(m.sender_id) === Number(meId);
            const prev = msgs[idx - 1];
            const isNewDay = !prev || (toDate(prev)?.toDateString() !== toDate(m)?.toDateString());

            return (
              <React.Fragment key={m.id ?? `${idx}-${pickTs(m) ?? 'na'}`}>
                {isNewDay && (
                  <div className="flex justify-center my-2">
                    <span className="text-xs text-gray-500 bg-gray-200/80 px-3 py-1 rounded-full">
                      {formatDateKR(m)}
                    </span>
                  </div>
                )}

                <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine ? (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[11px] text-gray-600">
                      상대
                    </div>
                  ) : (
                    <div className="w-7" />
                  )}

                  <div
                    className={`px-3 py-2 rounded-2xl text-sm shadow-sm max-w-[70%] ${
                      mine ? 'bg-green-200' : 'bg-white border'
                    }`}
                  >
                    <p className="text-gray-800 whitespace-pre-wrap">{m.content ?? m.message ?? ''}</p>
                    <div className="text-[11px] text-gray-400 mt-1">
                      { toDate(m)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '' }
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* 탈퇴회원 안내 */}
      {isOtherInactive && (
        <div className="px-4 py-2 text-[13px] text-red-600 bg-red-50 border-t border-red-100">
          탈퇴한 회원에게는 메시지를 보낼 수 없습니다.
        </div>
      )}

      

      {/* 새 메시지 배너 */}
      {showNewMsgBanner && !isAtBottom && (
        <div className="relative">
          <div className="absolute inset-x-0 -top-3 flex justify-center">
            <button
              onClick={onBannerClick}
              className="px-4 py-2 rounded-xl shadow-md bg-white/50 backdrop-blur text-gray-800 border border-gray-200 flex items-center gap-2"
            >
              <span className="font-medium">
                새로운 채팅이 왔어요{unreadCount > 1 ? ` (${unreadCount})` : ''}!
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-80"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 입력 */}
      <div className="border-t p-3 flex gap-2 sticky bottom-0 bg-white">
        <input
          type="text"
          value={text}
          placeholder="메시지 입력…"
          disabled={isOtherInactive}
          className="flex-1 rounded-full border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:bg-gray-100 disabled:text-gray-400"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          onClick={send}
          disabled={isOtherInactive}
          className={`rounded-full px-4 py-2 text-white text-sm shadow 
                    ${isOtherInactive ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
        >
          전송
        </button>
      </div>
    </div>
  );
}

