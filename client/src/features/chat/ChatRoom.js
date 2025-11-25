// client/src/features/chat/ChatRoom.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from '../../api/axiosInstance';
import { useParams, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const SCROLL_THRESHOLD = 16; // 바닥 판정 여유(px)

// 오늘이 trip 객체의 기간 안인지 확인
const isTodayWithinTrip = (tripObj) => {
  if (!tripObj?.start_date || !tripObj?.end_date) return false;
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(tripObj.start_date);
  const end = new Date(tripObj.end_date);
  const startDay = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return d >= startDay && d <= endDay;
};

const formatKoreanDate = (iso) =>
  new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

// mm:ss 포맷
const formatCountdown = (sec) => {
  if (sec == null) return '';
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
};

// 신고 사유 프리셋
const REPORT_REASONS = [
  { key: 'abuse', label: '욕설/비하·혐오 표현' },
  { key: 'nsfw', label: '성희롱/불쾌한 표현' },
  { key: 'spam', label: '도배/스팸' },
  { key: 'scam', label: '사기/금전 요구' },
  { key: 'noshow', label: '노쇼/약속 불이행' },
  { key: 'etc', label: '기타' },
];

// -------- 후기(리뷰) 상수 --------
const REVIEW_EMOTIONS = [
  { key: 'negative', label: '별로예요', className: 'border-red-300 text-red-600 bg-red-50' },
  { key: 'neutral', label: '좋아요', className: 'border-gray-300 text-gray-700 bg-gray-50' },
  { key: 'positive', label: '최고예요', className: 'border-green-300 text-green-700 bg-green-50' },
];

const REVIEW_TAGS_BY_EMOTION = {
  negative: [
    { key: 'noshow', label: '약속 장소/시간을 지키지 않았어요' },
    { key: 'rude', label: '말투/태도가 무례했어요' },
    { key: 'unsafe', label: '불안하거나 위험한 행동을 했어요' },
    { key: 'dirty', label: '위생/청결이 많이 아쉬웠어요' },
    { key: 'money', label: '비용 관련 갈등이 있었어요' },
    { key: 'schedule', label: '일정을 마음대로 바꾸었어요' },
    { key: 'etc', label: '기타 아쉬운 점이 있었어요' },
  ],
  neutral: [
    { key: 'quiet', label: '조용해서 대화가 많이 없었어요' },
    { key: 'preference_diff', label: '여행 스타일이 조금 안 맞았어요' },
    { key: 'late_small', label: '약속에 약간 늦는 편이었어요' },
    { key: 'photo_only', label: '사진 위주로 움직였어요' },
    { key: 'separate', label: '각자 따로 움직이는 시간이 많았어요' },
    { key: 'etc', label: '무난했어요' },
  ],
  positive: [
    { key: 'kind', label: '매너가 좋고 친절했어요' },
    { key: 'talk', label: '대화가 잘 통했어요' },
    { key: 'plan', label: '일정/예산 조율을 잘했어요' },
    { key: 'photo', label: '사진을 잘 찍어줬어요' },
    { key: 'food', label: '맛집을 잘 찾아줬어요' },
    { key: 'on_time', label: '시간 약속을 잘 지켰어요' },
    { key: 'again', label: '다음에 또 같이 가고 싶어요' },
  ],
};

export default function ChatRoom({
  roomIdOverride,
  embed = false,
  roomMeta,
}) {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
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

  // 여행 메이트 / trip 상태
  const [trip, setTrip] = useState(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [tripError, setTripError] = useState(null);

  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [tripTitle, setTripTitle] = useState('');
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');
  const [tripActionLoading, setTripActionLoading] = useState(false);  
  const [meetActionLoading, setMeetActionLoading] = useState(false);

  // -------- 후기(리뷰) 상태 --------
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewEligible, setReviewEligible] = useState(null); // { canReview, reason, trip, targetUser } 형태
  const [reviewEmotion, setReviewEmotion] = useState(null);   // 'negative' | 'neutral' | 'positive'
  const [reviewSelectedTags, setReviewSelectedTags] = useState([]); // ['kind', 'talk', ...]
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState(null);


  // A안: 동행 시작 카운트다운/초대 모달
  const [meetPhase, setMeetPhase] = useState('idle'); // idle | countdown | met | expired
  const [meetCountdownSec, setMeetCountdownSec] = useState(null);
  const countdownTimerRef = useRef(null);
  const [meetInviteModal, setMeetInviteModal] = useState(null); // { tripId, startedByNickname, expiresAt }

  // A안: 여행 날짜 선택 시 게시글 기간 밖 선택 허용 여부
  const [usePostRangeOnly, setUsePostRangeOnly] = useState(true);

  const token = localStorage.getItem('token');
  const meId = token ? jwtDecode(token)?.id : null;

  const otherUserId = roomMeta?.other_user_id ?? null;
  const otherNickname = roomMeta?.other_nickname || `채팅방 #${roomId}`;
  const subtitle =
    roomMeta?.post_title ||
    (roomMeta?.post_id ? `게시글 #${roomMeta.post_id}` : null);

  const [postStartDate, setPostStartDate] = useState(
    roomMeta?.post_start_date || roomMeta?.start_date || null
  );
  const [postEndDate, setPostEndDate] = useState(
    roomMeta?.post_end_date || roomMeta?.end_date || null
  );

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

  // -------- 카운트다운 헬퍼 --------
  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setMeetCountdownSec(null);
  }, []);

  const startCountdown = useCallback(
    (expiresAtIso) => {
      if (!expiresAtIso) return;
      clearCountdown();
      setMeetPhase('countdown');

      const expireMs = new Date(expiresAtIso).getTime();

      const tick = () => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expireMs - now) / 1000));
        setMeetCountdownSec(diff);
        if (diff <= 0) {
          clearCountdown();
          setMeetPhase('expired');
        }
      };

      tick();
      countdownTimerRef.current = setInterval(tick, 1000);
    },
    [clearCountdown]
  );

  useEffect(() => {
    return () => {
      clearCountdown();
    };
  }, [clearCountdown]);

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

  // -------- 이 채팅방의 trip + meetStatus 로드 --------
  const fetchTripForRoom = useCallback(async () => {
    if (!roomId) return;
    setTripLoading(true);
    setTripError(null);

    try {
      const res = await axios.get(`/api/chats/rooms/${roomId}/trip`);
      const data = res.data || {};

        // 서버에서 내려준 게시글 여행 기간을 state로 반영
      if (data.post_start_date || data.post_end_date) {
        setPostStartDate(data.post_start_date || null);
        setPostEndDate(data.post_end_date || null);
      }

      // 기존처럼 trip만 오는 경우와, { room, post, trip, meetStatus } 형태 둘 다 지원
      const tripData = data.trip || null;
      setTrip(tripData);

      // meetStatus가 있으면 A안 카운트다운 상태 세팅
      const meetStatus = data.meetStatus;
      if (meetStatus?.phase) {
        setMeetPhase(meetStatus.phase);
        if (meetStatus.phase === 'countdown' && meetStatus.expiresAt) {
          startCountdown(meetStatus.expiresAt);

          // 상대가 먼저 시작한 경우 → 큰 모달
          if (
            meetStatus.startedBy &&
            meId &&
            Number(meetStatus.startedBy) !== Number(meId)
          ) {
            setMeetInviteModal({
              tripId: tripData?.id,
              startedByNickname: meetStatus.startedByNickname || '상대방',
              expiresAt: meetStatus.expiresAt,
            });
          }
        } else if (meetStatus.phase === 'met') {
          clearCountdown();
          setMeetCountdownSec(null);
          setMeetPhase('met');
        } else if (meetStatus.phase === 'expired') {
          clearCountdown();
          setMeetCountdownSec(0);
          setMeetPhase('expired');
        }
      } else if (tripData?.status === 'met' || tripData?.status === 'finished') {
        // meetStatus 없지만 trip status로 met 추정
        clearCountdown();
        setMeetPhase('met');
      } else {
        // 별도 정보 없으면 idle
        clearCountdown();
        setMeetPhase('idle');
      }
    } catch (err) {
      console.error('trip 로드 실패:', err);
      // 404 등은 "trip 없음"으로 처리
      setTrip(null);
      setMeetPhase('idle');
      clearCountdown();
      if (err.response && err.response.status >= 500) {
        setTripError('여행 메이트 정보를 불러오지 못했습니다.');
      }
    } finally {
      setTripLoading(false);
    }
  }, [roomId, meId, startCountdown, clearCountdown]);


   // -------- 후기 가능 여부 조회 --------
  const refreshReviewEligibility = useCallback(
    async (tripId) => {
      if (!tripId) return;

      try {
        const res = await axios.get(`/api/trips/${tripId}/review/eligibility`);
        // 200이면 { canReview, reason, trip, targetUser } 구조
        setReviewEligible(res.data);
      } catch (err) {
        console.error('리뷰 가능 여부 조회 실패:', err);
        if (err.response?.data) {
          // 400/403/404도 { canReview:false, reason:... } 내려오도록 백엔드 짜놨으니까 그대로 사용
          setReviewEligible(err.response.data);
        } else {
          setReviewEligible({
            canReview: false,
            reason: 'INTERNAL_ERROR',
          });
        }
      }
    },
    []
  );


  useEffect(() => {
    fetchTripForRoom();
  }, [fetchTripForRoom]);

    // trip 변경 시 후기 상태 초기화 + 재조회
  useEffect(() => {
    setReviewEligible(null);
    setReviewEmotion(null);
    setReviewSelectedTags([]);
    setReviewComment('');
    setReviewError(null);

    if (trip?.id) {
      refreshReviewEligibility(trip.id);
    }
  }, [trip?.id, trip?.status, refreshReviewEligibility]);

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
  }, [roomId, mergeMessages, scrollToBottom]);

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

    setMeetPhase('idle');
    clearCountdown();
    setMeetInviteModal(null);

    if (!roomId) return;

    fetchMsgs();
    pollTimerRef.current = setInterval(fetchMsgs, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      isFetchingRef.current = false;
    };
  }, [roomId, fetchMsgs, clearCountdown]);

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

  // 읽음 처리
  useEffect(() => {
    if (!roomId) return;
    axios.put(`/api/chats/rooms/${roomId}/read`).catch(() => {});
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

  // -------- trip 생성/수락/거절 핸들러 --------
 const openTripModal = () => {
    const defaultTitle =
      (roomMeta && roomMeta.post_title) ||
      (trip && trip.title) ||
      '여행 메이트';

    // 1순위: 게시글 날짜, 2순위: trip 날짜
    const defaultStart =
      (postStartDate && String(postStartDate).slice(0, 10)) ||
      (trip?.start_date && String(trip.start_date).slice(0, 10)) ||
      '';
    const defaultEnd =
      (postEndDate && String(postEndDate).slice(0, 10)) ||
      (trip?.end_date && String(trip.end_date).slice(0, 10)) ||
      '';

    setTripTitle(defaultTitle);
    setTripStart(defaultStart);
    setTripEnd(defaultEnd);

    // 게시글 기간이 있으면 기본적으로 그 안에서만 선택하게(true)
    setUsePostRangeOnly(!!(postStartDate && postEndDate));

    setTripModalOpen(true);
  };
  
  const closeTripModal = () => {
    if (tripActionLoading) return;
    setTripModalOpen(false);
  };

  const handleCreateTrip = async () => {
    if (!roomId) return;
    if (!tripStart || !tripEnd) {
      alert('여행 시작일과 종료일을 선택해주세요.');
      return;
    }
    if (tripStart > tripEnd) {
      alert('종료일이 시작일보다 빠를 수 없습니다.');
      return;
    }

    // 게시글 기간 안에서만 선택하는 옵션
    if (usePostRangeOnly && postStartDate && postEndDate) {
      if (tripStart < postStartDate || tripEnd > postEndDate) {
        alert('게시글에 작성한 여행 기간 밖의 날짜는 선택할 수 없습니다.');
        return;
      }
    }

    try {
      setTripActionLoading(true);
      const res = await axios.post('/api/trips', {
        chatRoomId: Number(roomId),
        startDate: tripStart,
        endDate: tripEnd,
        title: tripTitle,
      });
      const newTrip = res.data?.trip || res.data;
      setTrip(newTrip);
      setTripModalOpen(false);
    } catch (err) {
      console.error('trip 생성 실패:', err);
      const msg =
        err.response?.data?.error || '여행 메이트 확정에 실패했습니다.';
      alert(msg);
    } finally {
      setTripActionLoading(false);
    }
  };

  const handleAcceptTrip = async () => {
    if (!trip?.id) return;
    try {
      setTripActionLoading(true);
      const res = await axios.post(`/api/trips/${trip.id}/invite/accept`);
      const newTrip = res.data?.trip || res.data;
      setTrip(newTrip);
      if (newTrip?.status === 'ready') {
        setMeetPhase('idle');
        clearCountdown();
      }
    } catch (err) {
      console.error('trip 수락 실패:', err);
      alert(err.response?.data?.error || '여행 초대 수락에 실패했습니다.');
    } finally {
      setTripActionLoading(false);
    }
  };

  const handleDeclineTrip = async () => {
    if (!trip?.id) return;
    if (!window.confirm('이 여행 초대를 거절할까요?')) return;

    try {
      setTripActionLoading(true);
      const res = await axios.post(`/api/trips/${trip.id}/invite/decline`);
      const newTrip = res.data?.trip || res.data;
      setTrip(newTrip);
      setMeetPhase('idle');
      clearCountdown();
    } catch (err) {
      console.error('trip 거절 실패:', err);
      alert(err.response?.data?.error || '여행 초대 거절에 실패했습니다.');
    } finally {
      setTripActionLoading(false);
    }
  };

  // -------- A안: 동행 시작 버튼(카운트다운 지원) --------
  const handleStartTogetherClick = async () => {
    if (!trip?.id) return;
    if (!isTodayWithinTrip(trip)) {
      alert('여행 기간 내에서만 동행 시작을 할 수 있습니다.');
      return;
    }
    try {
      setMeetActionLoading(true);
      const res = await axios.post(`/api/trips/${trip.id}/meet/button`);
      const data = res.data || {};

      if (data.trip) {
        setTrip(data.trip);
      }

      // 서버가 기존처럼 met / waiting만 주는 경우
      if (data.met) {
        clearCountdown();
        setMeetPhase('met');
        alert('동행이 인증되었습니다! 즐거운 여행 되세요 😊');
        return;
      }

      if (data.waiting && !data.expiresAt) {
        setMeetPhase('countdown'); // 시간 정보는 없지만 상태만 표시
        alert('내가 먼저 동행 시작을 눌렀어요. 상대도 10분 이내에 누르면 인증됩니다.');
        return;
      }

      // A안 확장: expiresAt / meetStatus 가 내려오는 경우
      if (data.expiresAt) {
        startCountdown(data.expiresAt);
        setMeetPhase('countdown');
      }

      if (data.meetStatus?.phase) {
        const phase = data.meetStatus.phase;
        setMeetPhase(phase);
        if (phase === 'countdown' && data.meetStatus.expiresAt) {
          startCountdown(data.meetStatus.expiresAt);
        } else if (phase === 'met') {
          clearCountdown();
        } else if (phase === 'expired') {
          clearCountdown();
          setMeetCountdownSec(0);
        }
      }
    } catch (err) {
      console.error('함께 시작 버튼 실패:', err);
      alert(
        err.response?.data?.error ||
          '동행 시작 처리 중 오류가 발생했습니다.'
      );
    } finally {
      setMeetActionLoading(false);
    }
  };

  // 모달에서 "지금 동행 시작하기" (B가 눌렀을 때)
  // 서버에서도 동일 엔드포인트(/meet/button)를 사용해
  // start/confirm 둘 다 처리한다고 가정
  const onAcceptMeetFromModal = async () => {
    const tripId = meetInviteModal?.tripId || trip?.id;
    if (!tripId) return;
    try {
      const res = await axios.post(`/api/trips/${tripId}/meet/button`);
      const data = res.data || {};
      if (data.trip) setTrip(data.trip);

      if (data.met) {
        clearCountdown();
        setMeetPhase('met');
      }
      setMeetInviteModal(null);
      fetchTripForRoom();
    } catch (e) {
      console.error('meet confirm failed:', e);
      alert('동행 시작 확정에 실패했습니다.');
    }
  };

  // 후기 모달 열기
  const openReviewModal = () => {
    if (!trip?.id) return;

    if (!reviewEligible || !reviewEligible.canReview) {
      let msg = '아직 후기를 작성할 수 없는 상태입니다.';
      if (reviewEligible?.reason === 'TRIP_NOT_FINISHED') {
        msg = '여행이 끝난 이후에 후기를 작성할 수 있어요.';
      } else if (reviewEligible?.reason === 'TRIP_NOT_MET') {
        msg = '실제 동행이 시작되지 않은 여행입니다.';
      } else if (reviewEligible?.reason === 'ALREADY_REVIEWED') {
        msg = '이미 후기를 작성해 주셨어요. 감사합니다!';
      }
      alert(msg);
      return;
    }

    setReviewModalOpen(true);
  };

  const closeReviewModal = () => {
    if (reviewSubmitting) return;
    setReviewModalOpen(false);
  };

  // 태그 토글 (최대 3개)
  const toggleReviewTag = (tagKey) => {
    setReviewSelectedTags((prev) => {
      if (prev.includes(tagKey)) {
        return prev.filter((t) => t !== tagKey);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, tagKey];
    });
  };

  // 후기 제출
  const handleSubmitReview = async () => {
    if (!trip?.id || !reviewEligible?.targetUser?.id) return;

    if (!reviewEmotion) {
      alert('전체적인 평가(별로예요/좋아요/최고예요)를 선택해 주세요.');
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewError(null);

      await axios.post('/api/reviews', {
        trip_id: trip.id,                          // ✅ snake_case
        target_id: reviewEligible.targetUser.id,   // ✅ snake_case
        emotion: reviewEmotion,                    // 그대로 사용 (negative/neutral/positive)
        tags: reviewSelectedTags,                  // ['quiet', 'kind', ...]
        comment: reviewComment?.trim() || null,
      });

      alert('후기를 남겨주셔서 감사합니다!');
      setReviewModalOpen(false);

      // 다시 조회해서 ALREADY_REVIEWED 상태로 바꿔주기
      refreshReviewEligibility(trip.id);
    } catch (err) {
      console.error('리뷰 제출 실패:', err);
      const msg = err.response?.data?.error || '후기 저장에 실패했습니다.';
      setReviewError(msg);
    } finally {
      setReviewSubmitting(false);
    }
  };


  const onSnoozeMeetFromModal = () => {
    setMeetInviteModal(null);
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

  const canRestartMeet =
    meetPhase === 'expired' && isTodayWithinTrip(trip || {});

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
              <div className="flex items-center gap-2">
                <div className="text-[11px] text-gray-500 truncate max-w-[160px] sm:max-w-xs">
                  {subtitle}
                </div>
                {/* 게시글 이동 버튼 */}
                {roomMeta?.post_id && (
                  <button
                    type="button"
                    onClick={() => navigate(`/mate/${roomMeta.post_id}`)}
                    className="hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full border text-gray-600 hover:bg-gray-50"
                  >
                    게시글 보러가기
                  </button>
                )}
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

      {/* 본문: trip 배너 + 메시지 리스트 + 입력창(sticky) */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 여행 메이트 / trip 상태 배너 */}
        <div className="border-b bg-emerald-50/70 px-4 py-2 text-[11px] sm:text-xs flex flex-wrap items-center gap-2">
          {tripLoading ? (
            <span className="text-gray-500">여행 메이트 정보를 불러오는 중...</span>
          ) : tripError ? (
            <span className="text-red-500">{tripError}</span>
          ) : !trip ? (
            <>
              <span className="text-emerald-800">
                아직 이 상대와의 여행이 확정되지 않았어요. 동행 일정과 기간을 먼저 정해보세요.
              </span>
              <button
                type="button"
                onClick={openTripModal}
                className="ml-auto px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700"
              >
                여행 메이트 확정하기
              </button>
            </>
          ) : (
            <>
              {trip.status === 'pending' && (
                <>
                  <span className="text-emerald-900 font-medium">
                    여행 메이트 초대가 진행 중입니다.
                  </span>
                  <span className="text-emerald-900/80">
                    기간: {trip.start_date?.slice(0, 10)} ~ {trip.end_date?.slice(0, 10)}
                  </span>
                  {meId && Number(trip.user_b) === Number(meId) ? (
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAcceptTrip}
                        disabled={tripActionLoading}
                        className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] hover:bg-emerald-700 disabled:opacity-60"
                      >
                        수락하기
                      </button>
                      <button
                        type="button"
                        onClick={handleDeclineTrip}
                        disabled={tripActionLoading}
                        className="px-2.5 py-1 rounded-full border border-emerald-400 text-emerald-700 text-[11px] hover:bg-emerald-50 disabled:opacity-60"
                      >
                        거절하기
                      </button>
                    </div>
                  ) : (
                    <span className="ml-auto text-emerald-700">
                      초대를 보냈어요. 상대의 수락을 기다리는 중입니다.
                    </span>
                  )}
                </>
              )}

              {trip.status === 'ready' && (
                <>
                  <span className="text-emerald-900 font-medium">
                    여행 메이트가 확정되었습니다.
                  </span>
                  <span className="text-emerald-900/80">
                    기간: {trip.start_date?.slice(0, 10)} ~ {trip.end_date?.slice(0, 10)}
                  </span>
                  <div className="ml-auto flex flex-col items-end gap-1">
                    {meetPhase === 'idle' && (
                      <>
                        {/* 두 줄 안내 문구 */}
                        <div className="text-[11px] text-right leading-tight">
                          <div className="text-emerald-700">
                            여행기간 동안 동행시작 버튼이 활성화됩니다.
                          </div>
                          <div className="text-emerald-600">
                            여행 당일에 둘 다 10분 이내로 &quot;동행 시작&quot;
                            을 누르면 동행이 인증됩니다.
                          </div>
                        </div>

                        {/* 버튼 (여행 기간일 때만) */}
                        {isTodayWithinTrip(trip) && (
                          <button
                            type="button"
                            onClick={handleStartTogetherClick}
                            disabled={meetActionLoading}
                            className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {meetActionLoading ? '처리 중...' : '오늘 동행 시작하기'}
                          </button>
                        )}
                      </>
                    )}

                    {meetPhase === 'expired' && (
                      <div className="flex items-center gap-2 text-[11px] text-red-600">
                        <span>카운트다운이 종료되었어요.</span>
                        {canRestartMeet && (
                          <button
                            type="button"
                            onClick={handleStartTogetherClick}
                            disabled={meetActionLoading}
                            className="px-3 py-1 rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-60"
                          >
                            다시 동행 시작하기
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {['met', 'finished'].includes(trip.status) && (
                <>
                  <span className="text-emerald-900 font-medium">
                    동행이 시작된 여행입니다.
                  </span>
              
                   {/* 여행 기간 표시 추가 */}
                  {(trip.start_date || trip.end_date) && (
                    <span className="text-emerald-900/80">
                      여행기간: {trip.start_date?.slice(0, 10)} ~ {trip.end_date?.slice(0, 10)}
                    </span>
                  )}
                </>
              )}

              {trip && (trip.status === 'met' || trip.status === 'finished') && (
                <div className="mt-1 sm:mt-0 sm:ml-auto flex items-center justify-end gap-2 flex-1">

                    {reviewEligible?.canReview && (
                      <button
                        onClick={openReviewModal}
                        className="px-3 py-1.5 text-xs sm:text-sm rounded-full border border-emerald-400 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                      >
                        동행 후기 작성하기
                      </button>
                    )}

                    {/* 이미 후기를 작성한 경우 → 오른쪽 정렬 + 위로 올림 */}
                    {!reviewEligible?.canReview &&
                      reviewEligible?.reason === 'ALREADY_REVIEWED' && (
                        <span className="text-xs text-emerald-700 ml-auto self-start text-right leading-tight">
                          이미 후기를 작성해 주셨어요.감사합니다!
                        </span>
                      )}
                  

                </div>
              )}
                
                

              {trip.status === 'cancelled' && (
                <span className="text-emerald-800">
                  이 여행 초대는 취소/거절되었습니다. 필요하다면 다시 여행 메이트를 확정할 수 있습니다.
                </span>
              )}
            </>
          )}
        </div>

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

      {/* 여행 메이트 확정 모달 (A안 날짜 제한 포함) */}
      {tripModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              여행 메이트 확정하기
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              이 채팅방의 상대와 함께할 여행 기간과 제목을 설정합니다.
            </p>

            {/* 게시글 기간 안내 (있을 때만) */}
            {postStartDate && postEndDate && (
              <div className="mb-3 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                게시글에 작성한 여행 기간:{' '}
                <span className="font-medium">
                  {postStartDate} ~ {postEndDate}
                </span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  여행 제목 (선택)
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  value={tripTitle}
                  onChange={(e) => setTripTitle(e.target.value)}
                  placeholder="예: 3월 제주 힐링 여행"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    시작일
                  </label>
                  <input
                    type="date"
                    className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    value={tripStart}
                    onChange={(e) => setTripStart(e.target.value)}
                    min={
                      usePostRangeOnly && postStartDate
                        ? postStartDate
                        : undefined
                    }
                    max={
                      usePostRangeOnly && postEndDate
                        ? postEndDate
                        : undefined
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    종료일
                  </label>
                  <input
                    type="date"
                    className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    value={tripEnd}
                    onChange={(e) => setTripEnd(e.target.value)}
                    min={
                      usePostRangeOnly && postStartDate
                        ? postStartDate
                        : undefined
                    }
                    max={
                      usePostRangeOnly && postEndDate
                        ? postEndDate
                        : undefined
                    }
                  />
                </div>
              </div>
            </div>

            {/* 게시글 기간 외 날짜 선택 토글 */}
            {postStartDate && postEndDate && (
              <div className="mt-3 text-xs text-gray-600 flex items-center gap-2">
                <input
                  id="custom-date-toggle"
                  type="checkbox"
                  checked={!usePostRangeOnly}
                  onChange={() => setUsePostRangeOnly((prev) => !prev)}
                />
                <label
                  htmlFor="custom-date-toggle"
                  className="cursor-pointer"
                >
                  게시글 기간 외 다른 날짜도 선택하기
                </label>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={closeTripModal}
                disabled={tripActionLoading}
                className="px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreateTrip}
                disabled={tripActionLoading}
                className="px-3 py-1.5 rounded-full bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60"
              >
                {tripActionLoading ? '저장 중...' : '확정하기'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              선택된 메시지:{' '}
              <span className="font-semibold">
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
       {/* ===== 후기 작성 모달 ===== */}
      {reviewModalOpen && reviewEligible?.targetUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-5 space-y-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                동행 후기 작성
              </h2>
              <button
                onClick={closeReviewModal}
                className="text-gray-400 hover:text-gray-600"
                disabled={reviewSubmitting}
              >
                ✕
              </button>
            </div>

            {/* 대상 정보 */}
            <div className="flex items-center gap-3 border rounded-xl px-3 py-2 bg-gray-50">
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600 overflow-hidden">
                {reviewEligible.targetUser.avatar_url ? (
                  <img
                    src={reviewEligible.targetUser.avatar_url}
                    alt={reviewEligible.targetUser.nickname || '프로필'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>상대</span>
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {reviewEligible.targetUser.nickname || '상대 사용자'}
                </div>
                {reviewEligible.trip && (
                  <div className="text-[11px] text-gray-500">
                    {reviewEligible.trip.start_date} ~ {reviewEligible.trip.end_date} 동행
                  </div>
                )}
              </div>
            </div>

            {/* 1단계: 전체 평가 */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700">
                1. 이번 동행은 전반적으로 어땠나요?
              </div>
              <div className="flex flex-wrap gap-2">
                {REVIEW_EMOTIONS.map((opt) => {
                  const selected = reviewEmotion === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setReviewEmotion(opt.key)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${
                        selected
                          ? `${opt.className} ring-1 ring-offset-1 ring-emerald-400`
                          : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
                      }`}
                      disabled={reviewSubmitting}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2단계: 원인 태그 */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700 flex items-center justify-between">
                <span>2. 그렇게 느낀 이유를 선택해 주세요 (1~3개)</span>
                <span className="text-[11px] text-gray-400">
                  {reviewSelectedTags.length}/3
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {(reviewEmotion ? REVIEW_TAGS_BY_EMOTION[reviewEmotion] : []).map(
                  (t) => {
                    const active = reviewSelectedTags.includes(t.key);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => toggleReviewTag(t.key)}
                        className={`px-3 py-1.5 rounded-full text-[11px] border transition ${
                          active
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                        disabled={reviewSubmitting}
                      >
                        {t.label}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* 3단계: 한 줄 코멘트 (선택) */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700">
                3. 한 줄로 남기고 싶은 후기가 있다면 써 주세요 (선택)
              </div>
              <textarea
                rows={3}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                placeholder="예) 시간 약속을 잘 지키고, 일정 조율을 잘해주셔서 편안한 여행이었어요."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                disabled={reviewSubmitting}
              />
            </div>

            {/* 에러 메시지 */}
            {reviewError && (
              <div className="text-xs text-red-500">
                {reviewError}
              </div>
            )}

            {/* 버튼들 */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={closeReviewModal}
                className="px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
                disabled={reviewSubmitting}
              >
                취소
              </button>
              <button
                onClick={handleSubmitReview}
                className="px-4 py-1.5 text-xs rounded-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? '저장 중...' : '후기 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A안: 상대가 먼저 동행 시작을 눌렀을 때 뜨는 모달 */}
      {meetInviteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold mb-3">
              동행 시작 알림
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              <b>{meetInviteModal.startedByNickname}</b>님이 동행 시작을 요청했어요.
            </p>
            <p className="text-xs text-gray-600 mb-4">
              10분 안에 동행을 시작하면 여행이 확정됩니다.
              <br />
              현재 남은 시간:{' '}
              <span className="font-mono font-semibold text-red-600">
                {formatCountdown(meetCountdownSec)}
              </span>
            </p>

            <div className="flex justify-end gap-2 text-sm">
              <button
                onClick={onSnoozeMeetFromModal}
                className="px-4 py-2 rounded-lg border bg-gray-50 hover:bg-gray-100"
              >
                나중에
              </button>
              <button
                onClick={onAcceptMeetFromModal}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                지금 동행 시작하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
