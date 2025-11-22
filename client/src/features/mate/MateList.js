// client/src/features/mate/MateList.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CountryCitySelect, { countryCityToLocation } from '../../components/CountryCitySelect';
import axios from '../../api/axiosInstance';

const ALL_STYLES = ['자연','맛집','사진','쇼핑','예술','역사','체험','축제','휴식'];

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  "http://localhost:4000";

const toAbs = (u) => {
  if (!u) return "";
  return /^https?:\/\//.test(u) ? u : `${API_BASE.replace(/\/$/, "")}${u}`;
};

const STYLE_COLOR = {
  '자연': 'bg-emerald-100 text-emerald-800',
  '맛집': 'bg-rose-100 text-rose-800',
  '사진': 'bg-violet-100 text-violet-800',
  '쇼핑': 'bg-amber-100 text-amber-800',
  '예술': 'bg-indigo-100 text-indigo-800',
  '역사': 'bg-yellow-100 text-yellow-800',
  '체험': 'bg-teal-100 text-teal-800',
  '축제': 'bg-fuchsia-100 text-fuchsia-800',
  '휴식': 'bg-slate-100 text-slate-800',
};

const TagChip = ({ label }) => (
  <span className={`inline-flex items-center px-3 py-[6px] rounded-full text-[13px] font-medium ${STYLE_COLOR[label] || 'bg-slate-100 text-slate-800'}`}>
    {label}
  </span>
);

const LineCalendar = ({ className = 'w-[18px] h-[18px] text-indigo-500' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M8 2v4M16 2v4M3 9h18" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);

function formatRange(s, e) {
  const S = (s || '').slice(0,10);
  const E = (e || '').slice(0,10);
  if (!S || !E) return `${S} ~ ${E}`;
  return `${S.replace(/-/g, '.')} - ${E.slice(5).replace('-', '.')}`;
}

// travel_style 문자열/배열을 공통 배열로 파싱
function parseStyles(p) {
  const raw = p.travel_styles ?? p.travel_style;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export default function MateList() {
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [regionFilter, setRegionFilter] = useState(null);
  const [openStyle, setOpenStyle] = useState(false);
  const [styles, setStyles] = useState([]);
  const [sort, setSort] = useState('latest'); // latest | travel_date
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const styleParam = useMemo(() => (styles.length ? styles.join(',') : ''), [styles]);

  const styleRef = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (styleRef.current && !styleRef.current.contains(e.target)) setOpenStyle(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => { fetchList(); }, []);
  const fetchList = async (params = {}) => {
    const { data } = await axios.get('/api/posts', { params });
    setPosts(data || []);
  };

  useEffect(() => {
    const locationParam = countryCityToLocation(regionFilter);
    fetchList({ location: locationParam, style: styleParam, startDate, endDate });
  }, [regionFilter, styleParam, startDate, endDate]);

  const sortedPosts = useMemo(() => {
    const arr = [...posts];
    if (sort === 'latest') {
      arr.sort((a, b) => {
        const A = (a.created_at || a.start_date || '');
        const B = (b.created_at || b.start_date || '');
        return A > B ? -1 : A < B ? 1 : 0;
      });
    } else {
      arr.sort((a, b) => {
        const A = a.start_date || '';
        const B = b.start_date || '';
        return A > B ? 1 : A < B ? -1 : 0;
      });
    }
    return arr;
  }, [posts, sort]);

  const resetFilters = () => {
    setRegionFilter(null);
    setStyles([]);
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-[1200px] px-6 pt-8 pb-16">
        {/* 헤더 — 우측 상단에 새 글 버튼 */}
        <header className="mb-6 flex items-start md:items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] leading-[30px] font-medium tracking-normal text-slate-900">
              여행 메이트 찾기
            </h1>
            <p className="mt-1.5 text-[13px] leading-[20px] text-slate-600">
              함께 여행할 동행자를 찾아보세요
            </p>
          </div>
          <button
            onClick={() => navigate('/mate/new')}
            className="h-9 px-3 rounded-md bg-green-600 text-white text-[13px] font-medium hover:bg-green-700"
          >
            + 새 글 작성
          </button>
        </header>

        {/* ✅ PlanFilters와 동일한 스타일의 필터 박스 */}
        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow p-3 border hover:shadow-md transition">
            <div className="grid grid-cols-12 gap-2 items-center">
              {/* 여행 지역 (CountryCitySelect) - 4칸 */}
              <div className="col-span-4">
                <label className="block text-xs text-zinc-600 mb-1">여행 지역</label>
                <CountryCitySelect
                  value={regionFilter}
                  onChange={setRegionFilter}
                  compact
                />
              </div>

              {/* 시작일 - 2칸 */}
              <div className="col-span-2">
                <label className="block text-xs text-zinc-600 mb-1">시작일</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border rounded-xl px-2 h-8 text-xs focus:ring-2 focus:ring-green-600 outline-none"
                />
              </div>

              {/* 종료일 - 2칸 */}
              <div className="col-span-2">
                <label className="block text-xs text-zinc-600 mb-1">종료일</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border rounded-xl px-2 h-8 text-xs focus:ring-2 focus:ring-green-600 outline-none"
                />
              </div>

              {/* 여행 취향 - 3칸 (PlanFilters 스타일) */}
              <div className="col-span-3" ref={styleRef}>
                <label className="block text-xs text-zinc-600 mb-1">여행 취향</label>
                <div className="flex gap-2 overflow-x-auto whitespace-nowrap no-scrollbar">
                  {ALL_STYLES.map((s) => {
                    const on = styles.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() =>
                          setStyles((prev) =>
                            on ? prev.filter((v) => v !== s) : [...prev, s]
                          )
                        }
                        type="button"
                        className={`px-3 h-8 text-xs rounded-full border transition ${
                          on
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-white hover:bg-zinc-50'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 초기화 + 정렬 - 1칸 (세로 스택) */}
              <div className="col-span-1 flex flex-col gap-1 items-stretch justify-end">
                <button
                  onClick={resetFilters}
                  type="button"
                  className="w-full h-8 px-3 rounded-xl border text-zinc-700 hover:bg-zinc-50 text-xs"
                >
                  초기화
                </button>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="w-full h-8 px-2 rounded-xl border text-xs text-zinc-700 bg-white focus:ring-2 focus:ring-green-600 outline-none"
                >
                  <option value="latest">최신 등록</option>
                  <option value="travel_date">여행 날짜</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* 카드 그리드 */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr">
          {sortedPosts.map((p) => (
            <article
              key={p.id}
              onClick={() => navigate(`/mate/${p.id}`)}
              className="p-7 rounded-[22px] border border-slate-100 bg-white cursor-pointer
                         shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all
                         hover:-translate-y-[2px] hover:shadow-[0_12px_36px_rgba(0,0,0,0.10)]
                         flex flex-col h-full"
            >
              <div className="flex items-center gap-2 text-[14px] text-slate-500 mb-3">
                <LineCalendar />
                <span>{formatRange(p.start_date, p.end_date)}</span>
              </div>

              <h3 className="text-[18px] leading-[24px] font-medium text-slate-900 mb-3">
                {p.title}
              </h3>

              <div className="flex flex-wrap gap-2 mb-5">
                <span className="inline-flex items-center gap-1 px-3 py-[6px] rounded-full text-[13px] font-medium bg-emerald-100 text-emerald-800">
                  <span>📍</span> {p.location || '지역 미정'}
                </span>
                {parseStyles(p).map((s, i) => (
                  <TagChip key={i} label={s} />
                ))}
              </div>

              <p
                className="text-[15px] leading-[23px] text-slate-700 mb-0"
                style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
              >
                {p.content}
              </p>

              <div className="mt-8" />

              <div className="mt-auto border-t border-slate-100 pt-4">
                <div className="flex items-center gap-3">
                  <img
                    src={toAbs(p.avatarUrl || p.avatar_url) || '/assets/avatar_placeholder.png'}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border border-white shadow"
                  />
                  <span className="text-[15px] text-slate-800 font-medium max-w-[140px] truncate">
                    {p.nickname || '사용자'}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}