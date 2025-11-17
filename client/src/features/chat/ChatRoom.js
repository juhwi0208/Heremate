// client/src/features/chat/ChatRoom.js
// client/src/features/chat/ChatRoom.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from '../../api/axiosInstance';
import { useParams } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const SCROLL_THRESHOLD = 16; // 바닥 판정 여유(px)

const formatKoreanDate = (iso) =>
  new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

// 신고 사유 프리셋
const REPORT_REASONS = [
  { key: 'abuse', label: '욕설/비하·혐오 표현' },
  { key: 'nsfw', label: '성희롱/불쾌한 표현' },
  { key: 'spam', label: '도배/스팸' },
  { key: 'scam', label: '사기/금전 요구' },
  { key: 'noshow', label: '노쇼/약속 불이행' },
  { key: 'etc', label: '기타' },
];

export default function ChatRoom({
  roomIdOverride,
  embed = false,
  roomMeta,
  onRead,
}) {
  const { id: routeId } = useParams();
  const roomId = roomIdOverride || routeId;

  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  const listRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showNewMsgBanner, setShowNewMsgBanner] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // 폴링 커서/상태
  const sinceRef = useRef(null);
  const pollTimerRef = useRef(null);
  const isFetchingRef = useRef(false); // 중복 fetch 방지
  const scrollTickingRef = useRef(false); // rAF 스로틀

  // 브라우저 알림 관련
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  // 신고 관련
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [reportReason, setReportReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const token = localStorage.getItem('token');
  const meId = token ? jwtDecode(token)?.id : null;

  const otherUserId = roomMeta?.other_user_id ?? null;
  const otherNickname = roomMeta?.other_nickname || `채팅방 #${roomId}`;
  const subtitle =
    roomMeta?.post_title ||
    (roomMeta?.post_id ? `게시글 #${roomMeta.post_id}` : null);

  // -------- 스크롤 유틸 --------
  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.style.scrollBehavior = 'auto';
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

  // -------- 메시지 병합 --------
  const mergeMessages = useCallback((prev, incoming) => {
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return { merged: prev, added: 0 };
    }

    const map = new Map(prev.map((m) => [m.id, m]));
    for (const m of incoming) {
      if (!map.has(m.id)) map.set(m.id, m);
    }
    const merged = Array.from(map.values());

    merged.sort((a, b) => {
      const ta = new Date(a.sent_at || a.created_at).getTime();
      const tb = new Date(b.sent_at || b.created_at).getTime();
      if (ta !== tb) return ta - tb;
      return (a.id || 0) - (b.id || 0);
    });

    const added = merged.length - prev.length;

    const last = merged[merged.length - 1];
    if (last?.sent_at || last?.created_at) {
      sinceRef.current = last.sent_at || last.created_at;
    }

    return { merged, added };
  }, []);

  // -------- 브라우저 알림 --------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supported = 'Notification' in window;
    setNotificationsSupported(supported);
    if (!supported) return;

    setNotificationPermission(Notification.permission);

    const saved = localStorage.getItem('hm_chat_notify');
    if (saved === '1') {
      setNotificationEnabled(true);
    }
  }, []);

  useEffect(() => {
    const onFocus = () => setIsWindowFocused(true);
    const onBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const handleToggleNotification = async () => {
    if (!notificationsSupported) return;

    if (notificationPermission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        if (perm !== 'granted') {
          setNotificationEnabled(false);
          localStorage.setItem('hm_chat_notify', '0');
          return;
        }
      } catch {
        return;
      }
    }

    if (notificationPermission === 'denied') {
      alert(
        '브라우저에서 알림이 차단되어 있습니다.\n브라우저 설정에서 사이트 알림을 허용해 주세요.'
      );
      return;
    }

    setNotificationEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('hm_chat_notify', next ? '1' : '0');
      return next;
    });
  };

  const showBrowserNotification = (newMessages) => {
    if (
      !notificationsSupported ||
      !notificationEnabled ||
      notificationPermission !== 'granted' ||
      isWindowFocused
    ) {
      return;
    }

    if (!Array.isArray(newMessages) || newMessages.length === 0) return;

    const otherMsgs = newMessages.filter((m) => {
      if (!meId) return true;
      return Number(m.sender_id) !== Number(meId);
    });

    if (otherMsgs.length === 0) return;

    const last = otherMsgs[otherMsgs.length - 1];
    const textContent = last.message ?? last.content ?? '';

    try {
      new Notification(otherNickname || 'HereMate 채팅', {
        body: textContent || '새로운 메시지가 도착했습니다.',
        tag: `chat-room-${roomId}`,
        renotify: true,
      });
    } catch {
      // 무시
    }
  };

  // -------- 메시지 로딩(폴링) --------
  const fetchMsgs = useCallback(async () => {
    if (!roomId) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const url = sinceRef.current
        ? `/api/chats/rooms/${roomId}/messages?after=${encodeURIComponent(
            sinceRef.current
          )}`
        : `/api/chats/rooms/${roomId}/messages`;

      const res = await axios.get(url);
      const incoming = Array.isArray(res.data) ? res.data : [];

      const el = listRef.current;
      const prevHeight = el ? el.scrollHeight : 0;
      const prevTop = el ? el.scrollTop : 0;

      if (incoming.length > 0) {
        // 브라우저 알림
        showBrowserNotification(incoming);
      }

      setMsgs((prev) => {
        const { merged, added } = mergeMessages(prev, incoming);
        if (added === 0) return prev;

        if (el) {
          if (computeIsAtBottom(el)) {
            requestAnimationFrame(scrollToBottom);
          } else {
            // 위로 스크롤 중: 배너 + 현재 위치 유지
            setShowNewMsgBanner(true);
            setUnreadCount((n) => n + added);

            requestAnimationFrame(() => {
              const newHeight = el.scrollHeight;
              const delta = newHeight - prevHeight;
              // 위쪽에 이전 메시지가 로드되는 구조가 아니라면
              // 그냥 prevTop 유지해도 되고, delta 더해도 됨
              el.scrollTop = prevTop + delta;
            });
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
  }, [roomId]);

  // roomId 변경 시: 초기화 + 폴링 재시작 + 신고 상태 리셋
  useEffect(() => {
    setMsgs([]);
    setShowNewMsgBanner(false);
    setUnreadCount(0);
    setLoading(true);
    sinceRef.current = null;

    setReportOpen(false);
    setSelectedMessageIds([]);
    setReportReason('');
    setReportDetail('');

    if (!roomId) return;

    fetchMsgs();
    pollTimerRef.current = setInterval(fetchMsgs, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      isFetchingRef.current = false;
    };
  }, [roomId, fetchMsgs]);

  // 스크롤 리스너
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
    updateIsAtBottom();

    return () => el.removeEventListener('scroll', onScroll);
  }, [updateIsAtBottom]);

  // 읽음 처리 + 상위 콜백
  useEffect(() => {
    if (!roomId) return;
    axios.put(`/api/chats/rooms/${roomId}/read`).catch(() => {});
    if (onRead) onRead(roomId);
  }, [roomId]);

  // -------- 전송 --------
  const send = async () => {
    const content = text.trim();
    if (!content || !roomId) return;

    try {
      const res = await axios.post(`/api/chats/rooms/${roomId}/messages`, {
        content,
      });

      setMsgs((prev) => {
        const { merged, added } = mergeMessages(prev, [res.data]);
        requestAnimationFrame(scrollToBottom);
        setShowNewMsgBanner(false);
        setUnreadCount(0);
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

  const onBannerClick = () => {
    scrollToBottom();
    setShowNewMsgBanner(false);
    setUnreadCount(0);
  };

  // -------- 신고 관련 --------
  const toggleSelectMessage = (id) => {
    setSelectedMessageIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const submitReport = async () => {
    if (!roomId) return;
    if (!reportReason || selectedMessageIds.length === 0) {
      alert('신고할 메시지와 사유를 선택해 주세요.');
      return;
    }

    try {
      setReportSubmitting(true);
      await axios.post('/api/reports', {
        context: 'chat',
        reason: reportReason,
        ref_id: Number(roomId),
        target_user_id: otherUserId,
        message_ids: selectedMessageIds,
        severity: 1,
        detail: reportDetail || null,
      });

      alert('신고가 접수되었습니다.');
      setReportOpen(false);
      setSelectedMessageIds([]);
      setReportReason('');
      setReportDetail('');
    } catch (err) {
      console.error('신고 실패:', err);
      alert('신고 처리 중 오류가 발생했습니다.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const containerClass = embed
    ? 'h-full flex flex-col bg-white'
    : 'max-w-2xl mx-auto h-[80vh] flex flex-col border rounded shadow bg-white';

  let lastDateLabel = null;

  const notificationButtonLabel = (() => {
    if (!notificationsSupported) return '알림 미지원';
    if (notificationPermission === 'denied') return '알림 차단됨';
    if (!notificationEnabled) return '알림 받기';
    return '알림 켜짐';
  })();

  return (
    <div className={containerClass}>
      {/* 헤더 */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-green-50 to-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center text-green-700 font-bold">
            {otherNickname?.charAt(0) || '#'}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-green-700 text-sm sm:text-base truncate">
              {otherNickname}
            </div>
            {subtitle && (
              <div className="text-[11px] text-gray-500 truncate max-w-[220px] sm:max-w-xs">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* 우측: 알림 + 신고 */}
        <div className="flex items-center gap-2">
          {/* 알림 토글 */}
          <button
            type="button"
            onClick={handleToggleNotification}
            className="hidden sm:inline-flex items-center px-2.5 py-1.5 rounded-full border text-[11px] text-gray-600 bg-white hover:bg-gray-50"
          >
            {notificationButtonLabel}
          </button>

          {/* 신고 아이콘 버튼 */}
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-red-200 text-red-500 hover:bg-red-50"
            title="채팅 신고"
          >
            {/* 플래그 아이콘 (SVG) */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h11l-1 5 4 2-1 5H4z" />
              <path d="M4 22V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* 본문: 메시지 리스트 + 입력창(sticky) */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 메시지 리스트 */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50"
        >
          {loading && msgs.length === 0 ? (
            <div className="space-y-2">
              <div className="h-4 w-20 bg-gray-200 animate-pulse rounded" />
              <div className="h-10 w-2/3 bg-gray-200 animate-pulse rounded" />
              <div className="h-10 w-1/2 bg-gray-200 animate-pulse rounded ml-auto" />
            </div>
          ) : msgs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              아직 대화가 없습니다. 첫 메시지를 보내보세요!
            </div>
          ) : (
            msgs.map((m) => {
              const mine = meId && Number(m.sender_id) === Number(meId);
              const ts = m.sent_at || m.created_at;
              const dateLabel = ts ? formatKoreanDate(ts) : '';
              const showDate = dateLabel && dateLabel !== lastDateLabel;
              if (showDate) lastDateLabel = dateLabel;

              const textContent = m.message ?? m.content ?? '';

              const isSelected = selectedMessageIds.includes(m.id);

              return (
                <React.Fragment key={m.id}>
                  {showDate && (
                    <div className="flex justify-center my-2">
                      <div className="px-3 py-1 rounded-full bg-white border text-[11px] text-gray-500">
                        {dateLabel}
                      </div>
                    </div>
                  )}

                  <div
                    className={`flex items-end gap-2 ${
                      mine ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!mine ? (
                      <div className="flex items-center gap-1">
                        {/* 프로필 동그라미 */}
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[11px] text-gray-600">
                          상대
                        </div>
                        {/* 신고 선택 체크박스 (상대 메시지 + 신고창 열렸을 때만) */}
                        {reportOpen && (
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-red-500"
                            checked={isSelected}
                            onChange={() => toggleSelectMessage(m.id)}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="w-7" />
                    )}

                    <div
                      className={`px-3 py-2 rounded-2xl text-sm shadow-sm max-w-[70%] ${
                        mine
                          ? 'bg-green-200'
                          : 'bg-white border border-gray-200'
                      } ${
                        !mine && reportOpen && isSelected
                          ? 'ring-2 ring-red-300'
                          : ''
                      }`}
                    >
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {textContent}
                      </p>
                      <div className="text-[11px] text-gray-400 mt-1 text-right">
                        {ts
                          ? new Date(ts).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* 새 메시지 배너 */}
        {showNewMsgBanner && !isAtBottom && (
          <div className="relative">
            <div className="absolute inset-x-0 -top-3 flex justify-center">
              <button
                onClick={onBannerClick}
                className="px-4 py-2 rounded-xl shadow-md bg-white/70 backdrop-blur text-gray-800 border border-gray-200 flex items-center gap-2"
              >
                <span className="font-medium">
                  새로운 채팅이 왔어요
                  {unreadCount > 1 ? ` (${unreadCount})` : ''}!
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

        {/* 입력창 (sticky) */}
        <div className="border-t p-3 bg-white sticky bottom-0">
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
              placeholder="메시지 입력."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              onClick={send}
              className="rounded-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm shadow"
            >
              전송
            </button>
          </div>
        </div>
      </div>

      {/* 신고 모달 */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">
                채팅 신고하기
              </h2>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              신고할 상대방 메시지를 선택하고, 신고 사유를 골라 주세요. 악의적인
              허위 신고는 제재 대상이 될 수 있습니다.
            </p>

            {/* 선택된 메시지 개수 */}
            <div className="text-xs text-gray-600 mb-2">
              선택된 메시지: <span className="font-semibold">
                {selectedMessageIds.length}
              </span>
              개
            </div>

            {/* 신고 사유 버튼 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setReportReason(r.key)}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] border ${
                    reportReason === r.key
                      ? 'bg-red-50 border-red-400 text-red-600'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* 상세 내용 */}
            <textarea
              className="w-full border rounded-lg px-2.5 py-2 text-xs mb-3 resize-none focus:outline-none focus:ring-1 focus:ring-red-300"
              rows={3}
              placeholder="신고 내용을 추가로 설명해 주세요. (선택)"
              value={reportDetail}
              onChange={(e) => setReportDetail(e.target.value)}
            />

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                disabled={reportSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitReport}
                className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={
                  reportSubmitting ||
                  !reportReason ||
                  selectedMessageIds.length === 0
                }
              >
                {reportSubmitting ? '신고 중...' : '신고 접수'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
