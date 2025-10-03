// client/src/features/mate/MateDetail.js
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from '../../api/axiosInstance';

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
    return () => { mounted = false; };
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

  if (!post) return <div className="p-6">불러오는 중...</div>;

  return (
    <div className="bg-gray-50">
      {/* ⬇️ 폭을 현재의 2/3 수준으로 축소 */}
      <div className="mx-auto max-w-[620px] px-6 pt-10 pb-20">
        {/* 브레드크럼 */}
        <div className="mb-4 text-[13px] text-slate-500">
          <Link to="/mate" className="hover:underline">메이트 찾기</Link>
          <span className="mx-2">›</span>
          <span className="text-slate-700">게시글 상세</span>
        </div>

        {/* 카드 */}
        <article className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(0,0,0,0.06)]">
          {/* 상단 뒤로가기 + 삭제 */}
          <div className="px-6 pt-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-600 hover:bg-slate-50"
              >
                <span className="text-slate-500">‹</span> 뒤로가기
              </button>
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
          <header className="px-6 pt-4">
            <h1 className="text-[26px] sm:text-[28px] font-semibold tracking-tight text-slate-900">
              {post.title}
            </h1>
          </header>

          {/* 메타 */}
          <section className="px-6 pt-3">
            <div className="text-[13px] text-slate-500 mb-3">
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
                  className={`px-3 py-1 rounded-full text-[12px] font-medium ${STYLE_COLOR[s] || 'bg-slate-100 text-slate-800'}`}
                >
                  {s}
                </span>
              ))}
            </div>

            {/* 본문: ⬇️ 짧아도 아래 여백을 충분히 주고, 그 다음 라인이 보이도록 */}
            <div className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800 min-h-[180px] pb-10">
              {post.content}
            </div>
          </section>

          {/* ⬇️ 구분 라인 */}
          <div className="border-t border-slate-200" />

          {/* 하단 */}
          <footer className="px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={post.avatarUrl || '/assets/avatar_placeholder.png'}
                alt="작성자"
                className="w-9 h-9 rounded-full object-cover border border-white shadow"
              />
              <div className="flex flex-col">
                <div className="text-[14px] text-slate-800 font-medium">
                  {post.nickname || '익명'}
                </div>
                <div className="text-[12px] text-slate-500">
                  {post.writer_joined_at ? `가입일 ${String(post.writer_joined_at).slice(0, 7)}` : ''}
                  {typeof post.writer_travel_count === 'number'
                    ? `${post.writer_joined_at ? ' · ' : ''}여행 ${post.writer_travel_count}회`
                    : ''}
                </div>
              </div>
            </div>

            {/* CTA: bg-green-600 유지 */}
            <button
              className="rounded-full bg-green-600 px-6 py-3 text-sm font-medium text-white shadow-md hover:bg-green-700"
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
