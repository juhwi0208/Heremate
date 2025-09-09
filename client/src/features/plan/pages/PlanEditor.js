// client/src/features/plan/pages/PlanEditor.js
// 지도 상단 검색 1곳 + 후보 패널 + 일정에 추가
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import ShareToggle from '../components/ShareToggle';

const GOOGLE_LIBRARIES = ['places'];

const ALL_PREFS = [
  { key: 'food', label: '맛집' },
  { key: 'nature', label: '자연' },
  { key: 'history', label: '역사' },
  { key: 'shopping', label: '쇼핑' },
  { key: 'museum', label: '미술/박물관' },
  { key: 'activity', label: '액티비티' },
];

// 날짜 유틸
const fmtLocalYMD = (d) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const rangeDates = (start, end) => {
  if (!start || !end) return [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const out = [];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(fmtLocalYMD(d));
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

// 운영시간 내 여부
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

// 오늘 영업시간 요약 텍스트
function summarizeTodayHours(openingHours, dateStr) {
  try {
    if (!openingHours?.periods?.length) return null;
    const wd = new Date(dateStr || new Date()).getDay(); // 0=Sun
    const today = openingHours.periods
      .filter((p) => {
        const od = p.open?.day;
        const cd = p.close?.day ?? od;
        return od === wd || cd === wd || (od <= wd && wd <= cd);
      })
      .map((p) => {
        const ot = p.open?.time || '0000';
        const ct = p.close?.time || '2400';
        const fmt = (t) => `${t.slice(0, 2)}:${t.slice(2)}`;
        return `${fmt(ot)}–${fmt(ct)}`;
      });
    if (today.length === 0) return null;
    return `오늘 영업: ${today.join(', ')}`;
  } catch {
    return null;
  }
}

export default function PlanEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);
  const isReadonly = location.pathname.endsWith('/readonly');
  const seed = !isEdit ? (location.state?.seedPlan || null) : null;

  // 상단 폼 상태 (기존 유지)
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

  // 구글맵
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_LIBRARIES,
  });
  const mapRef = useRef(null);
  const placesSvcRef = useRef(null);
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

  // 지도 하단 미리보기
  const [preview, setPreview] = useState({ photoUrl: '', name: '', info: '' });

  // 지도 상단 검색 상태
  const [mapSearch, setMapSearch] = useState('');
  const [mapPreds, setMapPreds] = useState([]);
  const [resultsOpen, setResultsOpen] = useState(false);

  // 후보 상세 캐시 (사진/주소/영업시간)
  const [detailCache, setDetailCache] = useState({}); // { [place_id]: { photoUrl, address, openingHours } }

  // 선택된 일정 (지도 마커/센터)
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const selectedEntry = useMemo(() => {
    const d = days[activeIdx];
    if (!d) return null;
    return d.entries.find((e) => e.id === selectedEntryId) || null;
  }, [days, activeIdx, selectedEntryId]);

  // Axios 토큰
  const token = localStorage.getItem('token');
  useEffect(() => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    else delete axios.defaults.headers.common['Authorization'];
  }, [token]);

  // 편집 로드
  useEffect(() => {
    if (!isEdit) return setLoading(false);
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const url = isReadonly ? `/api/plans/${id}/readonly` : `/api/plans/${id}`;
        const headers = isReadonly ? {} : (token ? { Authorization: `Bearer ${token}` } : {});
        const { data: p } = await axios.get(url, { headers });

        setTitle(p.title || '');
        setCountry(p.country || '');
        setRegion(p.region || '');
        try {
          const arr = typeof p.prefs === 'string' ? JSON.parse(p.prefs) : p.prefs;
          setPrefs(Array.isArray(arr) ? arr : []);
        } catch { setPrefs([]); }

        const s = fmtLocalYMD(p.start_date);
        const e = fmtLocalYMD(p.end_date);
        setStart(s); setEnd(e);
        setIsShared(p?.is_shared ? 1 : 0);

        let notes = {};
        try { notes = typeof p.notes === 'string' ? JSON.parse(p.notes) : (p.notes || {}); } catch { notes = {}; }

        const grouped = {};
        (p.items || []).forEach((it) => {
          const d = fmtLocalYMD(it.day);
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
          e?.response?.status === 401 ? '로그인이 만료되었거나 권한이 없습니다.'
          : e?.response?.status === 404 ? '계획을 찾을 수 없습니다.'
          : '계획 불러오기에 실패했습니다.'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, isReadonly, token]);

  // 생성모드에서 템플릿 적용
  useEffect(() => {
    if (isEdit || !seed) return;
    setTitle(seed.title ? `${seed.title} - 복사본` : '');
    setCountry(seed.country || '');
    setRegion(seed.region || '');
    try {
      const arr = typeof seed.prefs === 'string' ? JSON.parse(seed.prefs) : seed.prefs;
      setPrefs(Array.isArray(arr) ? arr : []);
    } catch { setPrefs([]); }
    const s = fmtLocalYMD(seed.start_date);
    const e = fmtLocalYMD(seed.end_date);
    setStart(s); setEnd(e);

    const notes = (() => { try { return typeof seed.notes === 'string' ? JSON.parse(seed.notes) : (seed.notes || {}); } catch { return {}; } })();
    const grouped = {};
    (seed.items || []).forEach((it) => {
      const d = fmtLocalYMD(it.day);
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
    const want = rangeDates(s, e);
    const arrDays = want.map((d) => grouped[d] || { date: d, note: notes[d] || '', entries: [] });
    setDays(arrDays);
    setActiveIdx(0);
  }, [isEdit, seed]);

  // 날짜 변경 가드(기존 유지)
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

  // 일정 CRUD (기존 유지)
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

  // DnD (Day 간 이동 포함)
  const dragRef = useRef(null);
  const onDragStart = (entryId) => (e) => {
    if (isReadonly) return;
    dragRef.current = { entryId, from: activeIdx };
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDayDragOver = (i) => (e) => { if (!isReadonly) e.preventDefault(); };
  const onDayDrop = (i) => (e) => {
    if (isReadonly) return;
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

  // 기존 엔트리 업데이트 함수 (상세 결과를 받아 엔트리 채움)
  const findPlaceAndUpdate = async (entryId, queryOrDetail) => {
    if (!isLoaded) return alert('지도 준비 중입니다. 잠시 후 다시 시도해 주세요.');
    const ac  = autocompleteRef.current;
    const svc = placesSvcRef.current;
    const gc  = geocoderRef.current;

    const apply = (r, options = {}) => {
      const {
        title = r.name || r.displayName?.text || queryOrDetail,
        address = r.formatted_address || r.formattedAddress || r.vicinity || '',
        lat = r.geometry?.location?.lat?.() ?? r.location?.lat?.() ?? null,
        lng = r.geometry?.location?.lng?.() ?? r.location?.lng?.() ?? null,
        placeId = r.place_id || r.id || null,
        openingHours = r.opening_hours || r.regularOpeningHours || null,
        photoUrl = (() => {
          const p = r.photos?.[0];
          try { return p?.getUrl ? p.getUrl({ maxWidth: 640, maxHeight: 480 }) : ''; } catch { return ''; }
        })(),
      } = options;
      updateEntry(entryId, { title, address, lat, lng, placeId, openingHours });
      setSelectedEntryId(entryId);
      setPreview({ photoUrl, name: title, info: address });
    };

    // 세부정보 객체가 바로 온 경우(Place Details 결과)
    if (queryOrDetail && typeof queryOrDetail === 'object') {
      apply(queryOrDetail);
      return;
    }

    const Place = window.google?.maps?.places?.Place;
    const tokenObj = sessionTokenRef.current || new window.google.maps.places.AutocompleteSessionToken();
    sessionTokenRef.current = tokenObj;

    const predictThenFetch = () =>
      new Promise((resolve) => {
        if (!ac) return resolve({ ok:false });
        const fetchFromPred = (pred) => {
          const pid = pred.place_id;
          if (Place) {
            (async () => {
              try {
                const place = new Place({ id: pid, requestedLanguage: 'ko', requestedRegion: 'KR' });
                const det = await place.fetchFields({ fields: ['id','displayName','formattedAddress','location','regularOpeningHours','photos','geometry','name','place_id','opening_hours'] });
                if (det) { apply(det); return resolve({ ok:true }); }
              } catch {}
              resolve({ ok:false });
            })();
            return;
          }
          if (svc?.getDetails) {
            return svc.getDetails(
              { placeId: pid, fields: ['name','formatted_address','geometry','place_id','opening_hours','photos'] },
              (det, st) => {
                if (st === window.google.maps.places.PlacesServiceStatus.OK && det) { apply(det); return resolve({ ok:true }); }
                resolve({ ok:false });
              }
            );
          }
          resolve({ ok:false });
        };
        ac.getPlacePredictions?.({ input: queryOrDetail, language: 'ko', region: 'KR', sessionToken: tokenObj }, (p2, s2) => {
          if (s2 === 'OK' && p2?.length) return fetchFromPred(p2[0]);
          resolve({ ok:false });
        });
      });

    const legacySearch = () =>
      new Promise((resolve) => {
        if (!svc?.textSearch) return resolve({ ok:false });
        svc.textSearch({ query: queryOrDetail, language: 'ko', region: 'KR' }, (results, st) => {
          if (st === 'OK' && results?.[0]) {
            const top = results[0];
            if (svc.getDetails && top.place_id) {
              return svc.getDetails(
                { placeId: top.place_id, fields: ['name','formatted_address','geometry','place_id','opening_hours','photos'] },
                (det, st2) => {
                  apply(det && st2 === 'OK' ? det : top);
                  resolve({ ok:true });
                }
              );
            }
            apply(top);
            return resolve({ ok:true });
          }
          resolve({ ok:false });
        });
      });

    const geocode = () =>
      new Promise((resolve) => {
        if (!gc) return resolve({ ok:false });
        gc.geocode({ address: queryOrDetail, language: 'ko', region: 'KR' }, (res, st) => {
          if (st === 'OK' && res?.[0]) { apply(res[0], { title: queryOrDetail }); return resolve({ ok:true }); }
          resolve({ ok:false });
        });
      });

    const r1 = await predictThenFetch(); if (r1.ok) return;
    const r2 = await legacySearch();     if (r2.ok) return;
    const r3 = await geocode();          if (r3.ok) return;

    // 서버 프록시 (선택)
    try {
      const resp = await fetch(`/api/places/search?q=${encodeURIComponent(queryOrDetail)}`);
      if (resp.ok) {
        const json = await resp.json();
        const top = json?.places?.[0];
        if (top) {
          const lat = top?.location?.latitude ?? null;
          const lng = top?.location?.longitude ?? null;
          updateEntry(entryId, {
            title: top?.displayName?.text || queryOrDetail,
            address: top?.formattedAddress || '',
            lat, lng,
            placeId: top?.id || null,
            openingHours: top?.regularOpeningHours || null,
          });
          setSelectedEntryId(entryId);
          setPreview({ photoUrl: '', name: top?.displayName?.text || '', info: top?.formattedAddress || '' });
          return;
        }
      }
    } catch {}
    alert('검색 결과가 없거나 API 권한 문제가 있습니다.');
  };

  // 저장
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
    if (isReadonly) return;
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
        await axios.put(`/api/plans/${id}`, payload);
        navigate('/plans');
      } else {
        const { data } = await axios.post('/api/plans', payload);
        if (data?.id) return navigate(`/plans/${data.id}`);
        navigate('/plans');
      }
    } catch (e) {
      console.error('[save failed]', e?.response?.status, e?.response?.data || e);
      alert(`저장 실패${e?.response?.data?.error ? `: ${e.response.data.error}` : ''}`);
    }
  };

  // 지도 센터
  useEffect(() => {
    if (!mapRef.current || !selectedEntry?.lat || !selectedEntry?.lng) return;
    mapRef.current.panTo({ lat: Number(selectedEntry.lat), lng: Number(selectedEntry.lng) });
  }, [selectedEntry]);

  const mapCenter =
    selectedEntry?.lat && selectedEntry?.lng
      ? { lat: Number(selectedEntry.lat), lng: Number(selectedEntry.lng) }
      : { lat: 37.5665, lng: 126.9780 };

  const togglePref = (k) =>
    setPrefs((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const Bubble = ({ children }) => (
    <div className="relative my-2">
      <div className="inline-block bg-zinc-200 text-zinc-700 text-xs px-3 py-2 rounded-2xl shadow-sm">{children}</div>
      <div className="absolute -bottom-2 left-4 w-0 h-0 border-l-6 border-r-6 border-t-6 border-l-transparent border-r-transparent border-t-zinc-200" />
    </div>
  );

  // 지도 오버레이 검색: 입력 → 예측
  const fetchMapPreds = (q) => {
    setMapSearch(q);
    if (!q) { setMapPreds([]); setResultsOpen(false); return; }
    const ac = autocompleteRef.current;
    const token = sessionTokenRef.current;
    if (!ac) return;
    ac.getPlacePredictions({ input: q, language: 'ko', region: 'KR', sessionToken: token }, (list, status) => {
      if (status === 'OK' && Array.isArray(list)) {
        setMapPreds(list.slice(0, 8));
        setResultsOpen(true);
      } else {
        setMapPreds([]);
        setResultsOpen(false);
      }
    });
  };

  // 후보 리스트가 바뀌면 간단한 상세(주소/사진/영업시간) 미리 요청해 캐시에 저장
  useEffect(() => {
    const svc = placesSvcRef.current;
    if (!svc) return;
    const nextIds = new Set(mapPreds.map((p) => p.place_id).filter(Boolean));
    nextIds.forEach((pid) => {
      if (detailCache[pid]) return;
      svc.getDetails(
        { placeId: pid, fields: ['formatted_address','opening_hours','photos'] },
        (det, st) => {
          if (st !== window.google.maps.places.PlacesServiceStatus.OK || !det) return;
          const photoUrl = (() => {
            const p = det.photos?.[0];
            try { return p?.getUrl ? p.getUrl({ maxWidth: 400, maxHeight: 300 }) : ''; } catch { return ''; }
          })();
          setDetailCache((prev) => ({
            ...prev,
            [pid]: {
              address: det.formatted_address || '',
              openingHours: det.opening_hours || null,
              photoUrl,
            },
          }));
        }
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapPreds]);

  // 후보 → 현재 Day에 추가 (시간은 비워둠)
  const addPredToCurrentDay = async (pred) => {
    if (!days[activeIdx]) return;
    // 1) 현재 Day에 빈 엔트리 추가
    setDays((prev) => {
      const copy = structuredClone(prev);
      copy[activeIdx].entries.push(emptyEntry());
      return copy;
    });

    // 2) 방금 추가된 엔트리 id
    const lastId = (() => {
      const d = days[activeIdx];
      const last = d?.entries?.at(-1);
      return last?.id || null;
    })();

    // 3) Place Details로 정확히 채우기
    const svc = placesSvcRef.current;
    const pid = pred.place_id;
    const applyDetail = (det) => {
      if (!lastId) return;
      findPlaceAndUpdate(lastId, det); // 상세 객체로 바로 적용
      const address = det.formatted_address || '';
      const photoUrl = (() => {
        const p = det.photos?.[0];
        try { return p?.getUrl ? p.getUrl({ maxWidth: 640, maxHeight: 480 }) : ''; } catch { return ''; }
      })();
      setPreview({ photoUrl, name: det.name || det.displayName?.text || '', info: address });
    };

    const Place = window.google?.maps?.places?.Place;
    if (Place && pid) {
      try {
        const place = new Place({ id: pid, requestedLanguage: 'ko', requestedRegion: 'KR' });
        const det = await place.fetchFields({ fields: ['id','name','displayName','formattedAddress','geometry','location','regularOpeningHours','opening_hours','photos','place_id'] });
        if (det) {
          applyDetail({
            ...det,
            formatted_address: det.formattedAddress,
            opening_hours: det.regularOpeningHours || det.opening_hours,
            place_id: det.id || det.place_id,
            geometry: det.geometry || { location: det.location },
          });
        }
      } catch {
        // fallback 아래로
      }
    }
    if (svc && pid) {
      svc.getDetails(
        { placeId: pid, fields: ['name','formatted_address','geometry','place_id','opening_hours','photos'] },
        (det, st) => {
          if (st === window.google.maps.places.PlacesServiceStatus.OK && det) applyDetail(det);
        }
      );
    }

    // 마무리: 패널 닫기
    setMapSearch('');
    setMapPreds([]);
    setResultsOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* 상단 타이틀 + 액션 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-green-700">{isReadonly ? '여행 계획(읽기전용)' : '여행 계획 보드'}</h2>
        <div className="flex gap-2">
          {isEdit && !isReadonly && (
            <ShareToggle
              planId={id}
              initialShared={Boolean(isShared)}
              onChange={(v) => setIsShared(v ? 1 : 0)}
            />
          )}
          {!isReadonly && (
            <button onClick={save} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm shadow">
              저장
            </button>
          )}
          <button onClick={() => navigate('/plans')} className="bg-white border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            목록
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 p-3 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700">⚠ {loadError}</div>
      )}

      {/* ====== 본문 2열 (왼쪽 기존 폼/일정, 오른쪽 지도) ====== */}
      <div className="grid grid-cols-12 gap-6">
        {/* 왼쪽 */}
        <div className="col-span-12 lg:col-span-8">
          {/* 상단 폼 */}
          <div className="text-xs text-zinc-500 mb-1">이번 여행의 제목을 설정해주세요!</div>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-300"
            placeholder="제목 (예: 오사카 3박4일)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isReadonly}
          />

          <Bubble>어디로 여행을 가시나요?</Bubble>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-200"
              placeholder="나라 (예: 일본)"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={isReadonly}
            />
            <input
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-200"
              placeholder="지역 (예: 오사카)"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={isReadonly}
            />
          </div>

          <Bubble>언제 여행을 가시나요?</Bubble>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={start} onChange={(e) => handleStartChange(e.target.value)} disabled={isReadonly} />
            <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={end} onChange={(e) => handleEndChange(e.target.value)} disabled={isReadonly} />
          </div>

          <div className="mt-4">
            <div className="text-xs text-zinc-500 mb-1">여행 취향(선택)</div>
            <div className="flex flex-wrap gap-2">
              {ALL_PREFS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => togglePref(p.key)}
                  disabled={isReadonly}
                  className={`px-3 py-1 rounded-full border text-sm transition ${prefs.includes(p.key) ? 'bg-green-600 text-white border-green-600' : 'bg-white hover:bg-zinc-50'} ${isReadonly ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Days + Notes + Schedules */}
          {!start || !end ? (
            <div className="mt-6 text-sm text-zinc-500">여행 시작일과 종료일을 설정하면 아래 편집 보드가 나타납니다.</div>
          ) : (
            <div className="grid grid-cols-12 gap-4 mt-6">
              {/* Days */}
              <aside className="col-span-12 md:col-span-4 lg:col-span-3 border rounded-xl bg-white shadow-sm">
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
              <main className="col-span-12 md:col-span-8 lg:col-span-9 border rounded-xl bg-white shadow-sm">
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
                    disabled={isReadonly}
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
                      <div
                        key={en.id}
                        draggable={!isReadonly}
                        onDragStart={onDragStart(en.id)}
                        className={`border rounded-lg p-3 shadow-sm ${mine ? 'ring-2 ring-green-300' : ''}`}
                      >
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-3">
                            <select
                              className="w-full border rounded px-2 py-2 text-sm"
                              value={en.time}
                              onChange={(e) => updateEntry(en.id, { time: e.target.value })}
                              disabled={isReadonly}
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
                              disabled={isReadonly}
                            />
                          </div>
                          <div className="col-span-5">
                            <input
                              className="w-full border rounded px-2 py-2 text-sm"
                              placeholder="설명 (예: Exhibition A)"
                              value={en.subtitle}
                              onChange={(e) => updateEntry(en.id, { subtitle: e.target.value })}
                              disabled={isReadonly}
                            />
                          </div>
                        </div>

                        {/* 🔻 스케줄 내부 '장소 검색' 입력 제거 (요건: 검색창은 지도 상단 1곳만) */}
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => setSelectedEntryId(en.id)} className="px-3 py-2 text-xs bg-white border rounded hover:bg-gray-50">지도 표시</button>
                          {!isReadonly && (
                            <>
                              <button onClick={() => moveEntryUpDown(en.id, -1)} className="px-2 py-2 text-xs bg-white border rounded hover:bg-gray-50">↑</button>
                              <button onClick={() => moveEntryUpDown(en.id, +1)} className="px-2 py-2 text-xs bg-white border rounded hover:bg-gray-50">↓</button>
                              <button onClick={() => removeEntry(en.id)} className="px-3 py-2 text-xs bg-red-50 border border-red-300 text-red-600 rounded hover:bg-red-100">삭제</button>
                            </>
                          )}
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

                  {!isReadonly && (
                    <button onClick={addEntry} className="w-full h-11 border-2 border-dashed rounded-lg text-sm hover:bg-gray-50">
                      + 일정 추가
                    </button>
                  )}
                </div>
              </main>
            </div>
          )}
        </div>

        {/* 오른쪽 지도 */}
        <div className="col-span-12 lg:col-span-4">
          <div className="sticky top-24">
            {/* 지도 카드 */}
            <div className="border rounded-2xl bg-white shadow-sm overflow-hidden relative">
              {/* 지도 상단 검색바 (오버레이) */}
              <div className="absolute top-3 left-3 right-3 z-10">
                <div className="bg-white rounded-xl shadow p-2">
                  <input
                    value={mapSearch}
                    onChange={(e) => fetchMapPreds(e.target.value)}
                    placeholder="장소 검색"
                    className="w-full px-3 py-2 text-sm outline-none"
                    onFocus={() => mapPreds.length && setResultsOpen(true)}
                    onBlur={() => setTimeout(() => setResultsOpen(false), 120)}
                  />
                </div>
                {resultsOpen && mapPreds.length > 0 && (
                  <div className="mt-2 max-h-72 overflow-y-auto bg-white/95 rounded-xl shadow divide-y">
                    {mapPreds.map((p) => {
                      const pid = p.place_id;
                      const det = pid ? detailCache[pid] : null;
                      const photoUrl = det?.photoUrl || '';
                      const address = det?.address || p.structured_formatting?.secondary_text || '';
                      const hoursTxt = det?.openingHours ? summarizeTodayHours(det.openingHours, days[activeIdx]?.date) : null;
                      return (
                        <div key={pid || p.description} className="p-3 text-sm">
                          <div className="flex gap-3">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-100 flex items-center justify-center shrink-0">
                              {photoUrl ? (
                                <img src={photoUrl} alt="preview" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[11px] text-zinc-400">사진 없음</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{p.structured_formatting?.main_text || p.description}</div>
                              <div className="text-gray-500 truncate">{address}</div>
                              {hoursTxt && <div className="mt-1 text-[11px] text-emerald-700">{hoursTxt}</div>}
                              <div className="mt-2 flex gap-2">
                                <button
                                  onClick={() => addPredToCurrentDay(p)}
                                  className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                  일정에 추가
                                </button>
                                <button
                                  onClick={() => {
                                    const q = p.description || p.structured_formatting?.main_text;
                                    if (!q || !geocoderRef.current) return;
                                    geocoderRef.current.geocode({ address: q, language: 'ko' }, (res, st) => {
                                      if (st === 'OK' && res?.[0]) {
                                        const loc = res[0].geometry?.location;
                                        loc && mapRef.current?.panTo({ lat: loc.lat(), lng: loc.lng() });
                                      }
                                    });
                                  }}
                                  className="px-3 py-1.5 text-xs rounded-lg border"
                                >
                                  지도 이동
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 지도 본체 */}
              <div className="h-[52vh]">
                {isLoaded ? (
                  <GoogleMap
                    center={mapCenter}
                    zoom={selectedEntry?.lat ? 14 : 12}
                    onLoad={onMapLoad}
                    onUnmount={onMapUnmount}
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    options={{
                      streetViewControl: false, // 로드뷰(노란 사람) 비활성화
                      fullscreenControl: false,
                      mapTypeControl: false,
                      zoomControl: true,
                      gestureHandling: 'greedy',
                    }}
                    onClick={() => { setResultsOpen(false); }}
                  >
                    {selectedEntry?.lat && selectedEntry?.lng && (
                      <Marker position={{ lat: Number(selectedEntry.lat), lng: Number(selectedEntry.lng) }} />
                    )}
                  </GoogleMap>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">구글맵 로드 중…</div>
                )}
              </div>
            </div>

            {/* 지도 하단 미리보기 3박스 */}
            <div className="grid grid-cols-12 gap-3 mt-3">
              <div className="col-span-4 border rounded-xl bg-white h-28 grid place-items-center text-xs text-zinc-500">
                {preview.photoUrl ? (
                  <img src={preview.photoUrl} alt="place" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  '검색된 장소\n후보의 사진'
                )}
              </div>
              <div className="col-span-8">
                <div className="border rounded-xl bg-white p-3 mb-3 text-sm">
                  <div className="text-zinc-400 mb-1">장소 이름</div>
                  <div className="font-medium">{preview.name || '—'}</div>
                </div>
                <div className="border rounded-xl bg-white p-3 text-sm">
                  <div className="text-zinc-400 mb-1">장소 정보</div>
                  <div className="text-zinc-700 whitespace-pre-line break-keep">{preview.info || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> {/* /본문 2열 */}

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
              <button
                className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700"
                onClick={() => {
                  const { nextStart, nextEnd } = dateChangeAsk;
                  const oldDs = rangeDates(start, end);
                  const newDs = rangeDates(nextStart, nextEnd);
                  const keepIdx = [];
                  for (let i = 1; i <= oldDs.length; i++) if (!dateChangeAsk.pick.has(i)) keepIdx.push(i);
                  const newDaysState = [];
                  const prev = structuredClone(days);
                  for (let i = 0; i < newDs.length; i++) {
                    const srcIdx = keepIdx[i] != null ? keepIdx[i] - 1 : null;
                    if (srcIdx != null && prev[srcIdx]) {
                      const copy = prev[srcIdx];
                      newDaysState.push({ ...copy, date: newDs[i] });
                    } else {
                      newDaysState.push({ date: newDs[i], note: '', entries: [] });
                    }
                  }
                  setStart(nextStart); setEnd(nextEnd);
                  setDays(newDaysState);
                  setActiveIdx(0);
                  setDateChangeAsk(null);
                }}
              >
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




