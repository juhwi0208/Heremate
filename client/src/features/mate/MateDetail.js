// client/src/features/mate/MateDetail.js
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import UserTrustPreview from '../../components/UserTrustPreview';

const STYLE_COLOR = {
  '자연': 'bg-emerald-100 text-emerald-800',
  '맛집': 'bg-rose-100 text-rose-800',
  '바다': 'bg-sky-100 text-sky-800',
  '사진': 'bg-violet-100 text-violet-800',
  '쇼핑': 'bg-amber-100 text-amber-800',
  '예술': 'bg-indigo-100 text-indigo-800',
  '축제': 'bg-fuchsia-100 text-fuchsia-800',
  '휴식': 'bg-slate-100 text-slate-800',
};

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  'http://localhost:4000';

const toAbs = (u) => {
  if (!u) return '';
  return /^https?:\/\//.test(u) ? u : `${API_BASE.replace(/\/$/, '')}${u}`;
};

function formatDateRange(start, end) {
  if (!start && !end) return '';
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  const pad = (n) => String(n).padStart(2, '0');
  if (s && e) {
    const sameYear = s.getFullYear() === e.getFullYear();
    const left = `${s.getFullYear()}.${pad(s.getMonth() + 1)}.${pad(s.getDate())}`;
    const right = sameYear
      ? `${pad(e.getMonth() + 1)}.${pad(e.getDate())}`
      : `${e.getFullYear()}.${pad(e.getMonth() + 1)}.${pad(e.getDate())}`;
    return `${left} - ${right}`;
  }
  const one = s || e;
  return `${one.getFullYear()}.${pad(one.getMonth() + 1)}.${pad(one.getDate())}`;
}

export default function MateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [me, setMe] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [p, u] = await Promise.allSettled([
          axios.get(`/api/posts/${id}`),
          axios.get('/auth/me'),
        ]);
        if (!mounted) return;
        if (p.status === 'fulfilled') setPost(p.value.data);
        if (u.status === 'fulfilled') setMe(u.value.data);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const mine = me && post && me.id === post.writer_id;

  const styles = useMemo(() => {
    if (!post) return [];
    if (Array.isArray(post.travel_styles)) return post.travel_styles;
    if (typeof post.travel_styles === 'string') {
      return post.travel_styles.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (post.travel_style) return [post.travel_style];
    return [];
  }, [post]);

  const handleDelete = async () => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`/api/posts/${id}`);
      alert('삭제 완료');
      navigate('/mate');
    } catch {
      alert('삭제 실패');
    }
  };

  if (!post) return <div className="p-6">불러오는 중.</div>;

  return (
    <div className="bg-gray-50">
      {/* 전체 폭: 조금 더 넓게 */}
      <div className="mx-auto max-w-[750px] px-6 pt-10 pb-20">

        {/* 목록으로 버튼 (카드 바깥, 상단) */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/mate')}
            className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
          >
            <span className="text-[15px]">◀</span>
            <span>목록으로</span>
          </button>
        </div>

        {/* 브레드크럼 */}
        <div className="mb-2 text-[13px] text-slate-500">
          <Link to="/mate" className="hover:underline">
            메이트 찾기
          </Link>
          <span className="mx-2">›</span>
          <span className="text-slate-700">게시글 상세</span>
        </div>

        

        {/* 카드 */}
        <article className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(0,0,0,0.06)]">
          {/* 상단: (삭제 버튼만) */}
          <div className="px-6 pt-6">
            <div className="flex items-center justify-end">
              {mine && (
                <button
                  onClick={handleDelete}
                  className="text-[12px] text-red-500 hover:text-red-600"
                  title="삭제"
                >
                  삭제
                </button>
              )}
            </div>
          </div>

          {/* 제목 */}
          <header className="px-6 pt-2">
            <h1 className="text-[26px] sm:text-[28px] font-semibold tracking-tight text-slate-900">
              {post.title}
            </h1>
          </header>

          {/* 메타 + 내용 */}
          <section className="px-6 pt-3">
            {/* 날짜 */}
            <div className="mb-3 text-[13px] text-slate-500">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">🗓</span>
                <span>{formatDateRange(post.start_date, post.end_date)}</span>
              </div>
            </div>

            {/* 취향 칩 */}
            <div className="flex flex-wrap gap-2">
              {styles.map((s, i) => (
                <span
                  key={`${s}-${i}`}
                  className={`px-3 py-1 rounded-full text-[12px] font-medium ${
                    STYLE_COLOR[s] || 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {s}
                </span>
              ))}
            </div>

            {/* 본문 */}
            <div className="mt-4 min-h-[180px] whitespace-pre-wrap pb-10 text-[15px] leading-relaxed text-slate-800">
              {post.content}
            </div>
          </section>

          {/* 구분 라인 */}
          <div className="border-t border-slate-200" />

          {/* 하단: 신뢰 정보 + 채팅 버튼 */}
          <footer className="px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
            {/* 신뢰 정보 카드 */}
            <div className="flex-1">
              <UserTrustPreview
                className="w-full"
                userId={post.writer_id}
                nickname={post.nickname}
                avatarUrl={toAbs(post.avatarUrl)}
                joinedAt={post.writer_joined_at}
                travelCount={post.writer_travel_count}
              />
            </div>

            {/* 채팅 시작하기 버튼 */}
            <button
              className="w-full sm:w-[190px] rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-green-700"
              onClick={async () => {
                try {
                  const r = await axios.post('/api/chats/rooms', {
                    targetUserId: post.writer_id,
                    postId: post.id,
                  });
                  const roomId = r?.data?.roomId;
                  if (roomId) navigate(`/chat/${roomId}`);
                } catch {
                  alert('채팅방 생성 실패: 로그인 상태를 확인해주세요.');
                }
              }}
            >
              💬 채팅 시작하기
            </button>
          </footer>
        </article>
      </div>
    </div>
  );
}
