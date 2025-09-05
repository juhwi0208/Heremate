// client/src/features/plan/pages/PlanEditor.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import ShareToggle from '../components/ShareToggle';

// ✅ 고정 상수(재로드 경고 방지)
const GOOGLE_LIBRARIES = ['places'];

const ALL_PREFS = [
  { key: 'food', label: '맛집' },
  { key: 'nature', label: '자연' },
  { key: 'history', label: '역사' },
  { key: 'shopping', label: '쇼핑' },
  { key: 'museum', label: '미술/박물관' },
  { key: 'activity', label: '액티비티' },
];

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const rangeDates = (start, end) => {
  if (!start || !end) return [];
  const s = new Date(start), e = new Date(end), out = [];
  const cur = new Date(s);
  while (cur <= e) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};
const emptyEntry = () => ({
  id: crypto.randomUUID(),
  time: '',
  title: '',
  subtitle: '',
  address: '',
  lat: null,
  lng: null,
  placeId: null,
  openingHours: null,
});
const reconcileDays = (dates, prevDays) => {
  const map = new Map(prevDays.map((d) => [d.date, d]));
  return dates.map((d) => map.get(d) || { date: d, note: '', entries: [] });
};
const times30m = Array.from({ length: 48 }, (_, i) => {
  const hh = String(Math.floor(i / 2)).padStart(2, '0');
  const mm = i % 2 ? '30' : '00';
  return `${hh}:${mm}`;
});
const hhmmNum = (s) => Number((s || '').replace(':', '') || 0);
function isWithinOpening(openingHours, dateStr, timeStr) {
  if (!openingHours?.periods?.length || !dateStr || !timeStr) return true;
  const wd = new Date(dateStr).getDay(); // 0=Sun
  const t = hhmmNum(timeStr);
  const slots = [];
  for (const p of openingHours.periods) {
    const od = p.open?.day;
    const cd = p.close?.day ?? od;
    const ot = Number(p.open?.time || '0000');
    const ct = Number(p.close?.time || '2400');
    if (od === wd && cd === wd) slots.push([ot, ct]);
    else if (od === wd && ((cd + 7 - wd) % 7 === 1)) slots.push([ot, 2400]);
    else if (((od + 7 - wd) % 7 === 6) && cd === wd) slots.push([0, ct]);
  }
  if (!slots.length) return true;
  return slots.some(([a, b]) => a <= t && t < b);
}

const PlanEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [prefs, setPrefs] = useState([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [days, setDays] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isShared, setIsShared] = useState(0);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);

  // Google
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_LIBRARIES,
  });
  const mapRef = useRef(null);
  const placesSvcRef = useRef(null);            // 레거시 폴백용
  const geocoderRef = useRef(null);
  const autocompleteRef = useRef(null);
  const sessionTokenRef = useRef(null);

  const onMapLoad = (m) => {
    mapRef.current = m;
    if (window.google?.maps) {
      if (!placesSvcRef.current) {
        const anchor = m || document.createElement('div');
        placesSvcRef.current = new window.google.maps.places.PlacesService(anchor);
      }
      if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder();
      if (!autocompleteRef.current) autocompleteRef.current = new window.google.maps.places.AutocompleteService();
      if (!sessionTokenRef.current) sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  };
  const onMapUnmount = () => { mapRef.current = null; };

  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const selectedEntry = useMemo(() => {
    const d = days[activeIdx];
    if (!d) return null;
    return d.entries.find((e) => e.id === selectedEntryId) || null;
  }, [days, activeIdx, selectedEntryId]);

  // 공통 Authorization
  const token = localStorage.getItem('token');
  useEffect(() => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    else delete axios.defaults.headers.common['Authorization'];
  }, [token]);

  // 편집 로드 (실패해도 페이지 유지 + 에러 표시)
  useEffect(() => {
    if (!isEdit) return setLoading(false);
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: p } = await axios.get(`/api/plans/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        setTitle(p.title || '');
        setCountry(p.country || '');
        setRegion(p.region || '');
        try {
          const arr = typeof p.prefs === 'string' ? JSON.parse(p.prefs) : p.prefs;
          setPrefs(Array.isArray(arr) ? arr : []);
        } catch { setPrefs([]); }

        const s = fmtDate(p.start_date);
        const e = fmtDate(p.end_date);
        setStart(s); setEnd(e);
        setIsShared(p?.is_shared ? 1 : 0);

        // notes 안전 파싱
        let notes = {};
        try { notes = typeof p.notes === 'string' ? JSON.parse(p.notes) : (p.notes || {}); } catch { notes = {}; }

        // items 구성
        const grouped = {};
        (p.items || []).forEach((it) => {
          const d = it.day;
          grouped[d] = grouped[d] || { date: d, note: notes[d] || '', entries: [] };
          grouped[d].entries.push({
            id: crypto.randomUUID(),
            time: it.time || '',
            title: it.place_name || '',
            subtitle: it.memo || '',
            address: it.address || '',
            lat: it.lat ?? null,
            lng: it.lng ?? null,
            placeId: it.place_id || null,
            openingHours: (() => {
              if (!it.opening_hours) return null;
              try { return typeof it.opening_hours === 'string' ? JSON.parse(it.opening_hours) : it.opening_hours; }
              catch { return null; }
            })(),
          });
        });

        const wantDates = rangeDates(s, e);
        const fromItems = wantDates.map((d) => grouped[d] || { date: d, note: notes[d] || '', entries: [] });
        setDays(fromItems);
        setActiveIdx(0);
      } catch (e) {
        console.error('[Plan load failed]', e?.response?.status, e?.response?.data || e);
        setLoadError(
          e?.response?.status === 401
            ? '로그인이 만료되었거나 권한이 없습니다.'
            : e?.response?.status === 404
            ? '계획을 찾을 수 없습니다.'
            : '계획 불러오기에 실패했습니다.'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, token]);

  /** 날짜 줄이기 모달 (로컬 압축) */
  const [dateChangeAsk, setDateChangeAsk] = useState(null);
  const scheduleDateShrinkGuard = (nextStart, nextEnd) => {
    const oldDs = rangeDates(start, end);
    const newDs = rangeDates(nextStart, nextEnd);
    if (oldDs.length && newDs.length && newDs.length < oldDs.length) {
      const dropNeeded = oldDs.length - newDs.length;
      const proposal = Array.from({ length: oldDs.length }, (_, i) => i + 1);
      const defaultDrop = new Set(proposal.slice(-dropNeeded));
      setDateChangeAsk({
        oldDates: oldDs, newDates: newDs, defaultDrop,
        nextStart, nextEnd, pick: new Set(defaultDrop),
      });
      return true;
    }
    setStart(nextStart); setEnd(nextEnd);
    setDays((prev) => reconcileDays(rangeDates(nextStart, nextEnd), prev));
    setActiveIdx(0);
    return false;
  };
  const handleStartChange = (v) => {
    if (end && new Date(v) > new Date(end)) {
      const newEnd = v;
      if (!scheduleDateShrinkGuard(v, newEnd)) { setStart(v); setEnd(newEnd); }
    } else {
      scheduleDateShrinkGuard(v, end || v);
    }
  };
  const handleEndChange = (v) => {
    if (start && new Date(v) < new Date(start)) {
      const newStart = v;
      if (!scheduleDateShrinkGuard(newStart, v)) { setStart(newStart); setEnd(v); }
    } else {
      scheduleDateShrinkGuard(start || v, v);
    }
  };
  const applyDateShrink = () => {
    if (!dateChangeAsk) return;
    const { nextStart, nextEnd, pick, newDates } = dateChangeAsk;
    const oldDs = rangeDates(start, end);
    const keepIdx = [];
    for (let i = 1; i <= oldDs.length; i++) if (!pick.has(i)) keepIdx.push(i);
    const newDaysState = [];
    const prev = structuredClone(days);
    for (let i = 0; i < newDates.length; i++) {
      const srcIdx = keepIdx[i] != null ? keepIdx[i] - 1 : null;
      if (srcIdx != null && prev[srcIdx]) {
        const copy = prev[srcIdx];
        newDaysState.push({ ...copy, date: newDates[i] });
      } else {
        newDaysState.push({ date: newDates[i], note: '', entries: [] });
      }
    }
    setStart(nextStart); setEnd(nextEnd);
    setDays(newDaysState);
    setActiveIdx(0);
    setDateChangeAsk(null);
  };

  // 지도 센터
  useEffect(() => {
    if (!mapRef.current || !selectedEntry?.lat || !selectedEntry?.lng) return;
    mapRef.current.panTo({ lat: Number(selectedEntry.lat), lng: Number(selectedEntry.lng) });
  }, [selectedEntry]);

  /** 일정 CRUD */
  const addEntry = () => {
    if (!days[activeIdx]) return;
    setDays((prev) => {
      const copy = structuredClone(prev);
      copy[activeIdx].entries.push(emptyEntry());
      return copy;
    });
  };
  const updateEntry = (entryId, patch) => {
    setDays((prev) => {
      const copy = structuredClone(prev);
      const list = copy[activeIdx]?.entries || [];
      const idx = list.findIndex((e) => e.id === entryId);
      if (idx >= 0) list[idx] = { ...list[idx], ...patch };
      return copy;
    });
  };
  const removeEntry = (entryId) => {
    setDays((prev) => {
      const copy = structuredClone(prev);
      const list = copy[activeIdx]?.entries || [];
      copy[activeIdx].entries = list.filter((e) => e.id !== entryId);
      if (selectedEntryId === entryId) setSelectedEntryId(null);
      return copy;
    });
  };
  const moveEntryUpDown = (entryId, dir) => {
    setDays((prev) => {
      const copy = structuredClone(prev);
      const list = copy[activeIdx]?.entries || [];
      const idx = list.findIndex((e) => e.id === entryId);
      if (idx < 0) return prev;
      const to = idx + dir;
      if (to < 0 || to >= list.length) return prev;
      [list[idx], list[to]] = [list[to], list[idx]];
      return copy;
    });
  };

  /** DnD: Day 간 이동 */
  const dragRef = useRef(null);
  const onDragStart = (entryId) => (e) => {
    dragRef.current = { entryId, from: activeIdx };
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDayDragOver = (i) => (e) => { e.preventDefault(); };
  const onDayDrop = (i) => (e) => {
    e.preventDefault();
    const info = dragRef.current; dragRef.current = null;
    if (!info) return;
    const { entryId, from } = info;
    if (from === i) return;
    setDays((prev) => {
      const copy = structuredClone(prev);
      const src = copy[from]; const dst = copy[i];
      if (!src || !dst) return prev;
      const idx = src.entries.findIndex((x) => x.id === entryId);
      if (idx < 0) return prev;
      const [item] = src.entries.splice(idx, 1);
      dst.entries.push(item);
      return copy;
    });
    setActiveIdx(i);
    setSelectedEntryId(null);
  };

  /** 🔎 새 Places API → 레거시 → 지오코딩 → 최후 제목만 */
  // 🔎 PlanEditor.js 안의 findPlaceAndUpdate를 아래 내용으로 통째 교체
const findPlaceAndUpdate = (entryId, query) => {
  if (!isLoaded) return alert('지도 준비 중입니다. 잠시 후 다시 시도해 주세요.');
  const ac = autocompleteRef.current;
  const svc = placesSvcRef.current;
  const gc  = geocoderRef.current;

  const log = (tag, ...args) => console.warn('[places]', tag, ...args);

  const apply = (r, options = {}) => {
    const {
      title = r.name || r.displayName?.text || query,
      address = r.formatted_address || r.formattedAddress || r.vicinity || '',
      lat = r.geometry?.location?.lat?.() ?? r.location?.lat?.() ?? null,
      lng = r.geometry?.location?.lng?.() ?? r.location?.lng?.() ?? null,
      placeId = r.place_id || r.id || null,
      openingHours = r.opening_hours || r.regularOpeningHours || null,
    } = options;
    updateEntry(entryId, { title, address, lat, lng, placeId, openingHours });
    setSelectedEntryId(entryId);
  };

  const Place = window.google?.maps?.places?.Place;
  const tokenObj = sessionTokenRef.current || new window.google.maps.places.AutocompleteSessionToken();
  sessionTokenRef.current = tokenObj;

  // 1) Autocomplete (query → prediction) → 새 Place.fetchFields
  const predictThenFetch = () =>
    new Promise((resolve) => {
      if (!ac) return resolve({ ok:false, why:'NO_AUTOCOMPLETE' });

      const fetchFromPred = async (pred) => {
        const pid = pred.place_id;
        log('prediction', pred);
        if (Place) {
          try {
            const place = new Place({ id: pid, requestedLanguage: 'ko', requestedRegion: 'KR' });
            const det = await place.fetchFields({
              fields: ['id','displayName','formattedAddress','location','regularOpeningHours'],
            });
            if (det) { apply(det); return resolve({ ok:true }); }
          } catch (e) { log('Place.fetchFields error', e); }
        }
        if (svc?.getDetails) {
          return svc.getDetails(
            { placeId: pid, fields: ['name','formatted_address','geometry','place_id','opening_hours'] },
            (det, st) => {
              log('getDetails status', st, det);
              if (st === window.google.maps.places.PlacesServiceStatus.OK && det) { apply(det); return resolve({ ok:true }); }
              resolve({ ok:false, why:`DETAILS_${st}` });
            }
          );
        }
        resolve({ ok:false, why:'NO_DETAILS' });
      };

      ac.getQueryPredictions({ input: query, language: 'ko', region: 'KR', sessionToken: tokenObj }, (p1, s1) => {
        log('getQueryPredictions', s1, p1);
        if (s1 === 'OK' && p1?.length) return fetchFromPred(p1[0]);

        ac.getPlacePredictions?.({ input: query, language: 'ko', region: 'KR', sessionToken: tokenObj }, (p2, s2) => {
          log('getPlacePredictions', s2, p2);
          if (s2 === 'OK' && p2?.length) return fetchFromPred(p2[0]);
          resolve({ ok:false, why:`PRED_${s1}_${s2}` });
        });
      });
    });

  // 2) 레거시 textSearch → details
  const legacySearch = () =>
    new Promise((resolve) => {
      if (!svc?.textSearch) return resolve({ ok:false, why:'NO_TEXTSEARCH' });
      svc.textSearch({ query, language: 'ko', region: 'KR' }, (results, st) => {
        log('textSearch', st, results);
        if (st === 'OK' && results?.[0]) {
          const top = results[0];
          if (svc.getDetails && top.place_id) {
            return svc.getDetails(
              { placeId: top.place_id, fields: ['name','formatted_address','geometry','place_id','opening_hours'] },
              (det, st2) => {
                log('details from textSearch', st2, det);
                apply(det && st2 === 'OK' ? det : top);
                resolve({ ok:true });
              }
            );
          }
          apply(top);
          return resolve({ ok:true });
        }
        resolve({ ok:false, why:`TEXT_${st}` });
      });
    });

  // 3) 지오코더
  const geocode = () =>
    new Promise((resolve) => {
      if (!gc) return resolve({ ok:false, why:'NO_GEOCODER' });
      gc.geocode({ address: query, language: 'ko', region: 'KR' }, (res, st) => {
        log('geocode', st, res);
        if (st === 'OK' && res?.[0]) { apply(res[0], { title: query }); return resolve({ ok:true }); }
        resolve({ ok:false, why:`GEOCODE_${st}` });
      });
    });

  (async () => {
    const r1 = await predictThenFetch(); if (r1.ok) return;
    const r2 = await legacySearch();     if (r2.ok) return;
    const r3 = await geocode();          if (r3.ok) return;
    log('all failed', r1, r2, r3);
    const likelihoodKey = [r1.why, r2.why, r3.why].join('|');
    if (/REQUEST_DENIED|API|KEY|DENIED|REFERER|BILLING/i.test(likelihoodKey)) {
      alert('장소 API 권한 문제로 검색이 거부되었습니다.\n- Google Cloud에서 Maps JavaScript API / Places API / Geocoding API 사용 설정\n- 결제 계정 연결\n- API 키에 http://localhost:3000/* 리퍼러 허용을 확인하세요.');
    } else {
      alert('검색 결과가 없습니다.');
    }
  })();

  
};
try {
  const resp = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
  if (resp.ok) {
    const json = await resp.json();
    const top = json?.places?.[0];
    if (top) {
      // NEW API 응답을 our entry로 매핑
      const lat = top?.location?.latitude ?? null;
      const lng = top?.location?.longitude ?? null;
      updateEntry(entryId, {
        title: top?.displayName?.text || query,
        address: top?.formattedAddress || '',
        lat, lng,
        placeId: top?.id || null,
        openingHours: top?.regularOpeningHours || null,
      });
      setSelectedEntryId(entryId);
      return;
    }
  }
} catch (e) {
  console.warn('[places proxy failed]', e);
}
alert('검색 결과가 없습니다.');


  /** 변환 & 저장 */
  const toNotesAndItems = () => {
    const notes = {};
    const items = [];
    days.forEach((d) => {
      if (d.note) notes[d.date] = d.note;
      (d.entries || []).forEach((en, idx) => {
        items.push({
          day: d.date,
          time: en.time || null,
          place_name: en.title || null,
          address: en.address || null,
          lat: en.lat ?? null,
          lng: en.lng ?? null,
          memo: en.subtitle || null,
          sort_order: idx,
          place_id: en.placeId || null,
          opening_hours: en.openingHours ? JSON.stringify(en.openingHours) : null,
        });
      });
    });
    return { notes, items };
  };

  const save = async () => {
    if (!token) return alert('로그인이 필요합니다.');
    if (!title.trim()) return alert('제목을 입력하세요.');
    if (!country.trim() || !region.trim()) return alert('나라와 지역을 입력하세요.');
    if (!start || !end) return alert('날짜를 설정하세요.');

    const { notes, items } = toNotesAndItems();
    const payload = {
      title, country, region, prefs,
      start_date: start || null,
      end_date: end || null,
      notes, items,
      is_shared: isShared,
    };
    try {
      if (isEdit) {
        await axios.put(`/api/plans/${id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        const { data } = await axios.post('/api/plans', payload, { headers: { Authorization: `Bearer ${token}` } });
        // 새로 만든 경우 방금 생성한 id로 이동 시, 다음 편집 진입에서 공유 버튼도 바로 보임
        if (data?.id) return navigate(`/plans/${data.id}`);
      }
      navigate('/plans');
    } catch (e) {
      console.error('[save failed]', e?.response?.status, e?.response?.data || e);
      alert(`저장 실패${e?.response?.data?.error ? `: ${e.response.data.error}` : ''}`);
    }
  };

  // 뷰 렌더
  const dayTabs = rangeDates(start, end);
  const mapCenter =
    selectedEntry?.lat && selectedEntry?.lng
      ? { lat: Number(selectedEntry.lat), lng: Number(selectedEntry.lng) }
      : { lat: 37.5665, lng: 126.978 };

  const togglePref = (k) =>
    setPrefs((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const Bubble = ({ children }) => (
    <div className="relative my-2">
      <div className="inline-block bg-zinc-200 text-zinc-700 text-xs px-3 py-2 rounded-2xl shadow-sm">
        {children}
      </div>
      <div className="absolute -bottom-2 left-4 w-0 h-0 border-l-6 border-r-6 border-t-6 border-l-transparent border-r-transparent border-t-zinc-200" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* 헤더: 편집 실패해도 ShareToggle은 보여줌(권한/토큰 이슈 디버깅 편의) */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-green-700">여행 계획 보드</h2>
        <div className="flex gap-2">
          {isEdit && (
            <ShareToggle
              planId={id}
              initialShared={Boolean(isShared)}
              onChange={(v) => setIsShared(v ? 1 : 0)}
            />
          )}
          <button onClick={save} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm shadow">
            저장
          </button>
          <button onClick={() => navigate('/plans')} className="bg-white border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            목록
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 p-3 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700">
          ⚠ {loadError}
        </div>
      )}

      {/* 상단 폼 */}
      <div className="text-xs text-zinc-500 mb-1">이번 여행의 제목을 설정해주세요!</div>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-300"
        placeholder="제목 (예: 오사카 3박4일)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <Bubble>어디로 여행을 가시나요?</Bubble>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-200"
          placeholder="나라 (예: 일본)"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
        <input
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-200"
          placeholder="지역 (예: 오사카)"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        />
      </div>

      <Bubble>언제 여행을 가시나요?</Bubble>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={start} onChange={(e) => handleStartChange(e.target.value)} />
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={end} onChange={(e) => handleEndChange(e.target.value)} />
      </div>

      <div className="mt-4">
        <div className="text-xs text-zinc-500 mb-1">여행 취향(선택)</div>
        <div className="flex flex-wrap gap-2">
          {ALL_PREFS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => togglePref(p.key)}
              className={`px-3 py-1 rounded-full border text-sm transition ${
                prefs.includes(p.key) ? 'bg-green-600 text-white border-green-600' : 'bg-white hover:bg-zinc-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 날짜 없으면 아래 가림 */}
      {!start || !end ? (
        <div className="mt-6 text-sm text-zinc-500">여행 시작일과 종료일을 설정하면 아래 편집 보드가 나타납니다.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-6">
          {/* Day 리스트 */}
          <aside className="md:col-span-2 border rounded-xl bg-white shadow-sm">
            <div className="px-4 py-3 border-b font-semibold">Days</div>
            <div className="divide-y">
              {rangeDates(start, end).map((d, i) => (
                <button
                  key={d}
                  onClick={() => setActiveIdx(i)}
                  onDragOver={onDayDragOver(i)}
                  onDrop={onDayDrop(i)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${i === activeIdx ? 'bg-green-50 text-green-700 font-medium' : ''}`}
                >
                  Day {i + 1} <span className="text-xs text-gray-400 ml-2">{d}</span>
                  <span className="ml-2 text-[11px] text-zinc-400">({days[i]?.entries?.length || 0})</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Notes + 일정 */}
          <main className="md:col-span-7 border rounded-xl bg-white shadow-sm">
            <div className="px-4 py-3 border-b font-semibold">Notes</div>
            <div className="p-4">
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm min-h-[90px] focus:outline-none focus:ring focus:ring-green-200"
                placeholder="오늘의 메모를 남겨보세요"
                value={days[activeIdx]?.note || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setDays((prev) => {
                    const copy = structuredClone(prev);
                    if (copy[activeIdx]) copy[activeIdx].note = val;
                    return copy;
                  });
                }}
              />
            </div>

            <div className="px-4 py-3 border-t font-semibold">Schedules</div>
            <div className="p-4 space-y-3">
              {(days[activeIdx]?.entries || []).map((en) => {
                const mine = selectedEntryId === en.id;
                const notOpen =
                  en.openingHours && en.time
                    ? !isWithinOpening(en.openingHours, days[activeIdx].date, en.time)
                    : false;

                return (
                  <div key={en.id} draggable onDragStart={onDragStart(en.id)} className={`border rounded-lg p-3 shadow-sm ${mine ? 'ring-2 ring-green-300' : ''}`}>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3">
                        <select
                          className="w-full border rounded px-2 py-2 text-sm"
                          value={en.time}
                          onChange={(e) => updateEntry(en.id, { time: e.target.value })}
                        >
                          <option value="">시간 선택</option>
                          {times30m.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {notOpen && (
                          <div className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                            <span>❗</span><span>이 시간은 운영시간이 아니에요!</span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-4">
                        <input
                          className="w-full border rounded px-2 py-2 text-sm"
                          placeholder="제목 (예: 박물관)"
                          value={en.title}
                          onChange={(e) => updateEntry(en.id, { title: e.target.value })}
                        />
                      </div>
                      <div className="col-span-5">
                        <input
                          className="w-full border rounded px-2 py-2 text-sm"
                          placeholder="설명 (예: Exhibition A)"
                          value={en.subtitle}
                          onChange={(e) => updateEntry(en.id, { subtitle: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <input
                        className="flex-1 border rounded px-2 py-2 text-sm"
                        placeholder="장소 검색(예: 경복궁) 후 Enter"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') findPlaceAndUpdate(en.id, e.currentTarget.value.trim());
                        }}
                      />
                      <button onClick={() => setSelectedEntryId(en.id)} className="px-3 py-2 text-xs bg-white border rounded hover:bg-gray-50">지도 표시</button>
                      <button onClick={() => moveEntryUpDown(en.id, -1)} className="px-2 py-2 text-xs bg-white border rounded hover:bg-gray-50">↑</button>
                      <button onClick={() => moveEntryUpDown(en.id, +1)} className="px-2 py-2 text-xs bg-white border rounded hover:bg-gray-50">↓</button>
                      <button onClick={() => removeEntry(en.id)} className="px-3 py-2 text-xs bg-red-50 border border-red-300 text-red-600 rounded hover:bg-red-100">삭제</button>
                    </div>

                    {(en.address || en.placeId) && (
                      <div className="mt-2 text-xs text-zinc-600">
                        {en.address || '주소 정보 없음'}
                        {en.placeId && <span className="ml-2 text-[11px] text-zinc-400">placeId: {en.placeId}</span>}
                      </div>
                    )}
                  </div>
                );
              })}

              <button onClick={addEntry} className="w-full h-11 border-2 border-dashed rounded-lg text-sm hover:bg-gray-50">
                + 일정 추가
              </button>
            </div>
          </main>

          {/* 지도 */}
          <aside className="md:col-span-3 border rounded-xl bg-white shadow-sm">
            <div className="px-4 py-3 border-b font-semibold">Map</div>
            <div className="h-[360px] rounded-b-xl overflow-hidden">
              {isLoaded ? (
                <GoogleMap
                  center={mapCenter}
                  zoom={selectedEntry?.lat ? 14 : 12}
                  onLoad={onMapLoad}
                  onUnmount={onMapUnmount}
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  options={{ disableDefaultUI: true }}
                >
                  {selectedEntry?.lat && selectedEntry?.lng && (
                    <Marker position={{ lat: Number(selectedEntry.lat), lng: Number(selectedEntry.lng) }} />
                  )}
                </GoogleMap>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">구글맵 로드 중…</div>
              )}
            </div>
            <div className="p-3 border-t text-xs text-gray-500">
              검색창에 장소를 입력하고 Enter → 좌표/영업시간까지 저장됩니다. (새 API → 레거시 → 지오코딩 순서)
            </div>
          </aside>
        </div>
      )}

      {/* 날짜 축소 모달 */}
      {dateChangeAsk && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-5 py-4 border-b">
              <div className="text-lg font-semibold">줄어든 날짜에 맞게 삭제할 Day 선택</div>
              <div className="mt-1 text-sm text-zinc-600">
                새 기간에 맞추기 위해 {dateChangeAsk.defaultDrop.size}개의 Day를 제거해야 합니다.
              </div>
            </div>
            <div className="p-4 max-h-[50vh] overflow-auto">
              <div className="grid grid-cols-1 gap-2">
                {dateChangeAsk.oldDates.map((d, i) => {
                  const idx = i + 1;
                  const checked = dateChangeAsk.pick.has(idx);
                  const toggle = () =>
                    setDateChangeAsk((prev) => ({
                      ...prev,
                      pick: new Set(
                        prev.pick.has(idx)
                          ? Array.from(prev.pick).filter((x) => x !== idx)
                          : [...prev.pick, idx]
                      ),
                    }));
                  return (
                    <label key={d} className="flex items-center justify-between border rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={checked} onChange={toggle} />
                        <span className="text-sm">Day {idx} <span className="text-xs text-zinc-500 ml-1">{d}</span></span>
                      </div>
                      <span className="text-xs text-zinc-500">일정 {days[i]?.entries?.length || 0}개</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-zinc-500">
                체크된 Day는 삭제됩니다. 체크 해제된 Day는 앞쪽부터 새 기간으로 압축 이동됩니다.
              </div>
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button className="px-4 py-2 text-sm rounded-lg border hover:bg-zinc-50" onClick={() => setDateChangeAsk(null)}>취소</button>
              <button className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700" onClick={applyDateShrink}>적용</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanEditor;
