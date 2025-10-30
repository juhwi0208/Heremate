// client\src\features\plan\PlanList\PlanList.js
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';
import SharedPlanCard from './SharedPlanCard';
import PlanFilters from './PlanFilters';
import { Globe2, User, MapPin, Trash2 } from 'lucide-react';

const diffDays = (s, e) => {
  if (!s || !e) return { days: 0, nights: 0 };
  const a = new Date(s);
  const b = new Date(e);
  const days = Math.max(1, Math.round((b - a) / 86400000) + 1);
  return { days, nights: Math.max(0, days - 1) };
};
const todayYMD = () => new Date().toISOString().slice(0,10);

const tagTone = (t) => {
  const k = String(t || '').toLowerCase();
  if (/(도시|city|urban)/.test(k))      return 'bg-indigo-100 text-indigo-700';
  if (/(자연|nature)/.test(k))         return 'bg-emerald-100 text-emerald-700';
  if (/(맛집|food|eat|gastronomy)/.test(k)) return 'bg-amber-100 text-amber-700';
  if (/(쇼핑|shopping)/.test(k))       return 'bg-pink-100 text-pink-700';
  if (/(역사|history)/.test(k))        return 'bg-sky-100 text-sky-700';
  if (/(휴양|relax)/.test(k))          return 'bg-teal-100 text-teal-700';
  return 'bg-zinc-100 text-zinc-700';
};

export default function PlanList() {
  const nav = useNavigate();

  // 탭
  const [tab, setTab] = useState('all'); // all | mine

  // 데이터
  const [shared, setShared] = useState([]);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState('');

  // 필터/정렬
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [prefs, setPrefs] = useState([]);
  const [sort, setSort] = useState('latest'); // latest | oldest | short | long

  useEffect(() => {
    let mounted = true;

    const loadShared = async () => {
      try {
        const { data } = await axios.get('/api/plans/shared');
        if (mounted) setShared(Array.isArray(data) ? data : []);
      } catch {
        if (mounted) { setShared([]); setError('공유 계획을 불러오지 못했습니다.'); }
      }
    };
    const loadMine = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setMine([]); return; }
      try {
        const { data } = await axios.get('/api/plans', { headers: { Authorization: `Bearer ${token}` } });
        if (mounted) setMine(Array.isArray(data) ? data : []);
      } catch {
        if (mounted) setMine([]);
      }
    };

    loadShared(); loadMine();
    return () => { mounted = false; };
  }, []);

  // 필터 적용
  const applyFilters = (list) => {
    const inMonth = (d, from, to) => {
      if (!from && !to) return true;
      const m = (x) => (x ? x.slice(0, 7) : '');
      const s = m(d.start_date), e = m(d.end_date);
      const f = from ? from.slice(0, 7) : '';
      const t = to ? to.slice(0, 7) : '';
      if (f && s < f && e < f) return false;
      if (t && s > t && e > t) return false;
      return true;
    };
    const hasPrefs = (d) => {
      if (!prefs.length) return true;
      let arr = [];
      try { arr = typeof d.prefs === 'string' ? JSON.parse(d.prefs) : (d.prefs || []); } catch { arr = []; }
      return prefs.every((p) => arr.includes(p));
    };
    return (list || []).filter((d) =>
      (!country || (d.country || '').includes(country)) &&
      (!region || (d.region || '').includes(region)) &&
      inMonth(d, monthFrom, monthTo) &&
      hasPrefs(d)
    );
  };
  const sortList = (list) => {
    const cp = [...list];
    const byDate = (x) => new Date(x.created_at || x.updated_at || 0).getTime();
    const byLen = (x) => diffDays(x.start_date, x.end_date).days;
    if (sort === 'latest') cp.sort((a, b) => byDate(b) - byDate(a));
    if (sort === 'oldest') cp.sort((a, b) => byDate(a) - byDate(b));
    if (sort === 'short')  cp.sort((a, b) => byLen(a) - byLen(b));
    if (sort === 'long')   cp.sort((a, b) => byLen(b) - byLen(a));
    return cp;
  };

  const sharedFiltered = useMemo(() => sortList(applyFilters(shared)), [shared, country, region, monthFrom, monthTo, prefs, sort]);
  const mineFiltered   = useMemo(() => sortList(applyFilters(mine)),   [mine, country, region, monthFrom, monthTo, prefs, sort]);

  // 카운트
  const mineStats = useMemo(() => {
    const sharing = mine.filter((m) => m.is_shared).length;
    return { writing: mine.length, sharing };
  }, [mine]);

  // 내 카드
  const MyCard = ({ p }) => {
    const t = todayYMD();
    const { days, nights } = diffDays(p.start_date, p.end_date);
    const done = p.end_date && p.end_date < t;
    const thumb = p.thumbnail_url || '/assets/default_plan.jpg';
    const tags = (() => {
      try { return typeof p.prefs === 'string' ? JSON.parse(p.prefs) : (p.prefs || []); } catch { return []; }
    })();

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const goDetail = () => { /* 편집/상세 */ 
      // 필요에 따라 /plans/:id 또는 /plans/:id/readonly로 조정
      return (window.location.href = `/plans/${p.id}`);
    };

    const toggleShare = async () => {
      try {
        if (p.is_shared) {
          await axios.delete(`/api/plans/${p.id}/share`, { headers });
          // unshare
          setMine((prev) => prev.map((x) => x.id === p.id ? { ...x, is_shared: 0 } : x));
        } else {
          await axios.post(`/api/plans/${p.id}/share`, {}, { headers });
          setMine((prev) => prev.map((x) => x.id === p.id ? { ...x, is_shared: 1 } : x));
        }
      } catch {
        alert('공유 설정 변경에 실패했습니다.');
      }
    };

    const remove = async () => {
      if (!window.confirm('이 여행 계획을 삭제할까요?')) return;
      try {
        await axios.delete(`/api/plans/${p.id}`, { headers });
        setMine((prev) => prev.filter((x) => x.id !== p.id));
      } catch {
        alert('삭제에 실패했습니다.');
      }
    };

    return (
      <div
        className="group cursor-pointer bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
        onClick={goDetail}
      >
        <div className="relative h-44 w-full overflow-hidden">
          <img src={thumb} alt="" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" />
          {days > 0 && (
            <div className="absolute top-2 right-2 text-[11px] bg-black/65 text-white px-2 py-1 rounded-full backdrop-blur">
              {nights}박 {days}일
            </div>
          )}
        </div>

        <div className="p-4">
          {/* 상태/공유 뱃지 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {done ? '여행 완료' : '계획중'}
            </span>
            {p.is_shared ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">공유중</span>
            ) : null}
          </div>

          {/* 제목 / 날짜 */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-zinc-900 truncate">{p.title || '제목 없음'}</h3>
            <span className="text-[12px] text-zinc-500 whitespace-nowrap">
              {p.start_date?.slice(0,10)} ~ {p.end_date?.slice(0,10)}
            </span>
          </div>

          {/* 지역 */}
          <div className="mt-1 text-sm text-zinc-600 flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span className="truncate">{p.country || '—'} · {p.region || '—'}</span>
          </div>

          {/* 취향 칩 */}
          {!!tags.length && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full ${tagTone(t)}`}>{t}</span>
              ))}
            </div>
          )}

          {/* 우하단 액션 (버튼은 클릭 전파 막기) */}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); toggleShare(); }}
              className={`px-3 py-1.5 text-xs rounded-lg border ${
                p.is_shared
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' // 공유취소
                  : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' // 공유하기
              }`}
            >
              {p.is_shared ? '공유 취소' : '공유하기'}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); remove(); }}
              className="p-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
              aria-label="삭제"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* 상단 제목 + 새 계획 버튼 */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-bold text-zinc-900">여행 계획</h2>
        <button
          onClick={() => nav('/plans/new')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm shadow"
        >
          + 새 계획 만들기
        </button>
      </div>

      {/* 탭 (아이콘 + pill) */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setTab('all')}
          className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-1 ${
            tab==='all' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          <Globe2 className="w-4 h-4" />
          모든 계획
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-1 ${
            tab==='mine' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          <User className="w-4 h-4" />
          내 계획
        </button>
      </div>

      {/* 필터 + 정렬 */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <PlanFilters
            country={country} setCountry={setCountry}
            region={region} setRegion={setRegion}
            monthFrom={monthFrom} setMonthFrom={setMonthFrom}
            monthTo={monthTo} setMonthTo={setMonthTo}
            prefs={prefs} setPrefs={setPrefs}
          />
        </div>
        <div className="w-44">
          <label className="block text-xs text-zinc-600 mb-1">정렬</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="w-full border rounded-xl px-2 h-10 text-sm focus:ring-2 focus:ring-emerald-600 outline-none bg-white"
          >
            <option value="latest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="short">짧은 일정순</option>
            <option value="long">긴 일정순</option>
          </select>
        </div>
      </div>

      {error && <div className="mt-3 text-sm text-red-600">⚠ {error}</div>}

      {/* 탭 콘텐츠 */}
      {tab === 'all' ? (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sharedFiltered.length === 0 ? (
            <div className="text-sm text-zinc-500">표시할 공유 계획이 없습니다.</div>
          ) : (
            sharedFiltered.map((p) => <SharedPlanCard key={p.id} plan={p} />)
          )}
        </div>
      ) : (
        <>
          {/* 카운트 바 */}
          <div className="mt-6 bg-white rounded-2xl border shadow p-4 flex items-center gap-4 text-sm">
            <div>내가 작성한 여행 계획 <b>{mineStats.writing}</b>개</div>
            <div className="text-zinc-300">|</div>
            <div>공유 중 <b className="text-emerald-700">{mineStats.sharing}</b>개</div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {mineFiltered.length === 0 ? (
              <div className="text-sm text-zinc-500">아직 등록된 여행 계획이 없습니다.</div>
            ) : (
              mineFiltered.map((p) => <MyCard key={p.id} p={p} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
