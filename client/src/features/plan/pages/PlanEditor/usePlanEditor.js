import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useJsApiLoader } from '@react-google-maps/api';

// 요구: fixed 스타일 옵션(라벨)
export const STYLE_OPTIONS = ['자연','맛집','사진','쇼핑','예술','역사','체험','축제','휴식'];
// 내부 저장 키/라벨
export const PREFS = [
  { key: 'nature', label: '자연' },
  { key: 'food', label: '맛집' },
  { key: 'photo', label: '사진' },
  { key: 'shopping', label: '쇼핑' },
  { key: 'art', label: '예술' },
  { key: 'history', label: '역사' },
  { key: 'activity', label: '체험' },
  { key: 'festival', label: '축제' },
  { key: 'relax', label: '휴식' },
];

// ✅ 로더: places + marker
const GOOGLE_LIBRARIES = ['places', 'marker'];

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
const emptyEntry = (id) => ({
  id: id ?? crypto.randomUUID(),
  time: '',
  title: '',
  subtitle: '',
  address: '',
  lat: null,
  lng: null,
  placeId: null,
  openingHours: null,
  photoUrl: '',
});
const reconcileDays = (dates, prevDays) => {
  const map = new Map(prevDays.map((d) => [d.date, d]));
  return dates.map((d) => map.get(d) || { date: d, note: '', entries: [] });
};

// ✅ 영업시간 정규화(v3 형식으로 통일)
const normalizeOpeningHours = (oh) => {
  if (!oh) return null;
  if (oh.periods && oh.periods.length && oh.periods[0]?.open?.day !== undefined) return oh;
  const dayMap = { SUNDAY:0, MONDAY:1, TUESDAY:2, WEDNESDAY:3, THURSDAY:4, FRIDAY:5, SATURDAY:6 };
  if (oh.periods && oh.periods.length && (oh.periods[0]?.openDay || oh.periods[0]?.closeDay)) {
    return {
      periods: oh.periods.map(p => ({
        open:  { day: dayMap[p.openDay],  time: String(p.openTime  || '').padStart(4, '0') },
        close: { day: dayMap[p.closeDay ?? p.openDay], time: String(p.closeTime || '').padStart(4, '0') }
      }))
    };
  }
  return null;
};

// ✅ 항상 `places/...` 형태로 보정
const normalizePlaceId = (pid) => {
  if (!pid) return null;
  const s = String(pid);
  return s.startsWith('places/') ? s : `places/${s}`;
};

export default function usePlanEditor({ isEdit, isReadonly, planId, seed }) {
  // 로그인 가드
  const token = localStorage.getItem('token');
  const [loginGuard, setLoginGuard] = useState(!isEdit && !token && !isReadonly);

  // 구글맵 로더
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_LIBRARIES,
  });

  // 상단 폼/상태
  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [prefs, setPrefs] = useState([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [days, setDays] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isShared, setIsShared] = useState(0);
  const [loadError, setLoadError] = useState(null);

  // 선택 엔트리
  const [selectedEntryId, setSelectedEntryId] = useState(null);

  // 맵/검색
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const sessionTokenRef = useRef(null);

  const onMapLoad = (m) => {
    mapRef.current = m;
    if (window.google?.maps) {
      if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder();
      if (!sessionTokenRef.current) sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  };
  const onMapUnmount = () => { mapRef.current = null; };

  // 검색 상태
  const [mapSearch, setMapSearch] = useState('');
  const [mapPreds, setMapPreds] = useState([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [detailCache, setDetailCache] = useState({}); // { [pid]: { name, photoUrl, address, openingHours } }

  // Axios 토큰
  useEffect(() => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    else delete axios.defaults.headers.common['Authorization'];
  }, [token]);

  // 로드 (편집/복사)
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const url = isReadonly ? `/api/plans/${planId}/readonly` : `/api/plans/${planId}`;
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
            photoUrl: '',
          });
        });

        const want = rangeDates(s, e);
        const arr = want.map((d) => grouped[d] || { date: d, note: notes[d] || '', entries: [] });
        setDays(arr);
        setActiveIdx(0);
      } catch (e) {
        setLoadError(
          e?.response?.status === 401 ? '로그인이 만료되었거나 권한이 없습니다.'
          : e?.response?.status === 404 ? '계획을 찾을 수 없습니다.'
          : '계획 불러오기에 실패했습니다.'
        );
      }
    })();
  }, [isEdit, isReadonly, planId, token]);

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
        photoUrl: '',
      });
    });
    const want = rangeDates(s, e);
    const arr = want.map((d) => grouped[d] || { date: d, note: notes[d] || '', entries: [] });
    setDays(arr);
    setActiveIdx(0);
  }, [isEdit, seed]);

  // 날짜 변경
  const scheduleDateShrinkGuard = (nextStart, nextEnd) => {
    const oldDs = rangeDates(start, end);
    const newDs = rangeDates(nextStart, nextEnd);
    if (oldDs.length && newDs.length && newDs.length < oldDs.length) {
      setStart(nextStart); setEnd(nextEnd);
      setDays(prev => reconcileDays(newDs, prev));
      setActiveIdx(0);
      return;
    }
    setStart(nextStart); setEnd(nextEnd);
    setDays(prev => reconcileDays(newDs, prev));
    setActiveIdx(0);
  };
  const handleStartChange = (v) => {
    if (end && new Date(v) > new Date(end)) scheduleDateShrinkGuard(v, v);
    else scheduleDateShrinkGuard(v, end || v);
  };
  const handleEndChange = (v) => {
    if (start && new Date(v) < new Date(start)) scheduleDateShrinkGuard(v, v);
    else scheduleDateShrinkGuard(start || v, v);
  };

  // CRUD
  const addEntry = () => {
    if (!days[activeIdx]) return null;
    const id = crypto.randomUUID();
    setDays((prev) => {
      const copy = structuredClone(prev);
      copy[activeIdx].entries.push(emptyEntry(id));
      return copy;
    });
    return id;
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

  // DnD (Day간 이동)
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

  // ✅ (C) 서버 API 기반 후보 검색 + 지도 중심(lat/lng) bias 전달
  const fetchMapPreds = (q) => {
    setMapSearch(q);
    if (!q?.trim()) { setMapPreds([]); setResultsOpen(false); return; }
    (async () => {
      try {
        // 현재 맵 중심(없으면 서울 광화문 좌표)
        const center = mapRef.current?.getCenter?.();
        const lat = center?.lat?.() ?? 37.5665;
        const lng = center?.lng?.() ?? 126.9780;

        const global = 1; // ✅ 전세계 모드 기본.

        const r1 = await axios.get('/api/places/autocomplete', { params: { q, lat, lng, global } }).catch(() => null);
        const list = r1?.data?.predictions || [];
        const base = list.length
          ? list
          : (await axios.get('/api/places/search', { params: { q, lat, lng, global } })).data?.places || [];

        const norm = (base || []).slice(0, 8).map((it) => {
          const v3id = it.place_id || it.id || null;

          // 이름/주소 분리 유지
          const main =
            it.structured_formatting?.main_text ||
            it.structuredFormat?.mainText?.text ||
            it.displayName?.text ||
            it.name || '';

          const secondary =
            it.structured_formatting?.secondary_text ||
            it.structuredFormat?.secondaryText?.text ||
            it.formattedAddress || '';

          return {
            place_id: v3id,                                // v3 'places/...' 우선
            description: secondary ? `${main}, ${secondary}` : main,
            structured_formatting: {
              main_text: main,             // ← 이름만
              secondary_text: secondary,   // ← 주소만
            },
          };
        });
        setMapPreds(norm);
        setResultsOpen(norm.length > 0);
      } catch {
        setMapPreds([]); setResultsOpen(false);
      }
    })();
  };

  // 추천 카드 → 상세 캐시 프리패치
  useEffect(() => {
    const Place = window.google?.maps?.places?.Place;
    if (!Place) return;
    const nextIds = Array.from(new Set(mapPreds.map((p) => p.place_id).filter(Boolean)));

    const fetchWithFallback = async (pid, pred) => {
      // 1) JS Places → 바로 시도
      try {
        const place = new Place({ id: normalizePlaceId(pid), requestedLanguage: 'ko', requestedRegion: 'KR' });
        const det = await place.fetchFields({
          fields: ['id','displayName','formattedAddress','regularOpeningHours','photos']
        });
        const photoUrl = (() => {
          const ph = det?.photos?.[0];
          try { return ph?.getURI ? ph.getURI({ maxWidth: 320, maxHeight: 240 }) : ''; } catch { return ''; }
        })();
        setDetailCache((prev) => ({
          ...prev,
          [pid]: {
            name: det?.displayName?.text || '',
            address: det?.formattedAddress || '',
            openingHours: normalizeOpeningHours(det?.regularOpeningHours) || null,
            photoUrl
          },
        }));
        return;
      } catch {
        // fallthrough
      }

      // 2) text search → v3 id 재시도
      let v3id = null;
      try {
        const main = pred?.structured_formatting?.main_text || '';
        const sec  = pred?.structured_formatting?.secondary_text || '';
        const q = (main && sec) ? `${main} ${sec}` : (pred?.description || main || '');
        if (!q) throw new Error('no query');

        const center = mapRef.current?.getCenter?.();
        const lat = center?.lat?.() ?? 37.5665;
        const lng = center?.lng?.() ?? 126.9780;

        const r = await axios.get('/api/places/search', { params: { q, lat, lng, global: 1 } }).catch(() => null);
        const v3 = r?.data?.places?.[0];
        v3id = v3?.id;
        if (!v3id) throw new Error('no v3id');

        const place2 = new Place({ id: normalizePlaceId(v3id), requestedLanguage: 'ko', requestedRegion: 'KR' });
        const det2 = await place2.fetchFields({
          fields: ['id','displayName','formattedAddress','regularOpeningHours','photos']
        });
        const photoUrl2 = (() => {
          const ph = det2?.photos?.[0];
          try { return ph?.getURI ? ph.getURI({ maxWidth: 320, maxHeight: 240 }) : ''; } catch { return ''; }
        })();
        setDetailCache((prev) => ({
          ...prev,
          [pid]: {
            name: det2?.displayName?.text || v3?.displayName?.text || main || '',
            address: det2?.formattedAddress || v3?.formattedAddress || sec || '',
            openingHours: normalizeOpeningHours(det2?.regularOpeningHours) || null,
            photoUrl: photoUrl2
          },
        }));
        return;
      } catch {
        // fallthrough
      }

      // 3) 서버 폴백(/api/places/details)
      try {
        const fallbackId = normalizePlaceId(v3id || pid);
        const resp = await axios.get('/api/places/details', { params: { id: fallbackId } }).catch(() => null);
        const det = resp?.data;
        if (det) {
          setDetailCache((prev) => ({
            ...prev,
            [pid]: {
              name: det?.displayName?.text || pred?.structured_formatting?.main_text || '',
              address: det?.formattedAddress || pred?.structured_formatting?.secondary_text || '',
              openingHours: det?.regularOpeningHours || null,
              photoUrl: det?.photoUrl || '',
            },
          }));
        }
      } catch {}
    };

    nextIds.forEach((pid) => {
      if (detailCache[pid]) return;
      const pred = mapPreds.find((p) => p.place_id === pid) || {};
      fetchWithFallback(pid, pred);
    });
  }, [mapPreds, detailCache]);

  // 엔트리 적용
  const applyDetailToEntry = (entryId, detail, labelFallback) => {
    const getPhotoUrl = (obj) => {
      const p = obj?.photos?.[0];
      try { return p?.getURI ? p.getURI({ maxWidth: 640, maxHeight: 480 }) : ''; } catch { return ''; }
    };
    updateEntry(entryId, {
      title: detail?.displayName?.text || detail?.name || labelFallback || '',
      address: detail?.formattedAddress || detail?.formatted_address || detail?.vicinity || '',
      lat: detail?.geometry?.location?.lat?.() ?? detail?.location?.lat?.() ?? null,
      lng: detail?.geometry?.location?.lng?.() ?? detail?.location?.lng?.() ?? null,
      placeId: detail?.place_id || detail?.id || null,
      openingHours: normalizeOpeningHours(detail?.regularOpeningHours || detail?.opening_hours) || null,
      photoUrl: getPhotoUrl(detail),
    });
    setSelectedEntryId(entryId);
  };

  // 자유 검색으로 엔트리 갱신 (서버 검색 → Place.fetchFields, 실패 시 geocode)
  const findPlaceAndUpdate = async (entryId, queryOrDetail) => {
    if (!isLoaded) return alert('지도 준비 중입니다. 잠시 후 다시 시도해 주세요.');
    if (queryOrDetail && typeof queryOrDetail === 'object') {
      applyDetailToEntry(entryId, queryOrDetail);
      return;
    }

    const Place = window.google?.maps?.places?.Place;
    const q = String(queryOrDetail || '').trim();
    if (!q) return;

    // 현재 맵 중심(없으면 서울)
    const center = mapRef.current?.getCenter?.();
    const lat = center?.lat?.() ?? 37.5665;
    const lng = center?.lng?.() ?? 126.9780;

    // 1) 서버 자동완성 → id 획득
    let top = null;
    try {
      const r1 = await axios.get('/api/places/autocomplete', { params: { q, lat, lng } }).catch(() => null);
      const preds = r1?.data?.predictions || [];
      if (preds.length) top = preds[0];
    } catch {}
    // 2) 없으면 서버 검색
    if (!top) {
      try {
        const r2 = await axios.get('/api/places/search', { params: { q, lat, lng } }).catch(() => null);
        const list = r2?.data?.places || [];
        if (list.length) top = list[0];
      } catch {}
    }

    // 3) id가 있으면 Place.fetchFields로 상세 조회
    try {
      const id = top?.id || top?.place_id;
      if (Place && id) {
        const place = new Place({ id: normalizePlaceId(id), requestedLanguage: 'ko', requestedRegion: 'KR' });
        const det = await place.fetchFields({
          fields: ['id','displayName','formattedAddress','location','regularOpeningHours','photos','geometry','name','place_id','opening_hours']
        });
        if (det) { applyDetailToEntry(entryId, det, q); return; }
      }
    } catch {}

    // 4) 최후: 지오코드
    const gc = geocoderRef.current;
    if (gc) {
      gc.geocode({ address: q, language: 'ko', region: 'KR' }, (res, st) => {
        if (st === 'OK' && res?.[0]) {
          applyDetailToEntry(entryId, res[0], q);
          return;
        }
        alert('검색 결과가 없거나 API 권한 문제가 있습니다.');
      });
      return;
    }
    alert('검색 결과가 없거나 API 권한 문제가 있습니다.');
  };

  // 일정으로 추가: Place.fetchFields 우선, 실패 시 서버 검색 fallback
  const addPredToCurrentDay = async (pred) => {
    if (isReadonly) return;
    const newId = (() => {
      const id = crypto.randomUUID();
      setDays(prev => {
        const copy = structuredClone(prev);
        copy[activeIdx].entries.push(emptyEntry(id));
        return copy;
      });
      return id;
    })();

    const pid = pred?.place_id;
    const Place = window.google?.maps?.places?.Place;
    if (pid && Place) {
      try {
        const place = new Place({ id: normalizePlaceId(pid), requestedLanguage: 'ko', requestedRegion: 'KR' });
        const det = await place.fetchFields({
          fields: ['id','displayName','formattedAddress','location','regularOpeningHours','photos']
        });
        if (det) {
          applyDetailToEntry(newId, det);
          setMapSearch(''); setMapPreds([]); setResultsOpen(false);
          return;
        }
      } catch { /* fallthrough */ }
    }
    // 서버 검색으로 fallback
    const label =
      pred.structured_formatting?.main_text
      || pred.displayName?.text
      || pred.name
      || mapSearch;
    await findPlaceAndUpdate(newId, label);
    setMapSearch(''); setMapPreds([]); setResultsOpen(false);
  };

  // 후보만 지도 이동(PlanEditor에서 Marker만 표시)
  const panToPred = async (pred) => {
    const Place = window.google?.maps?.places?.Place;
    const pid = pred.place_id;
    if (Place && pid) {
      try {
        const det = await new Place({ id: normalizePlaceId(pid), requestedLanguage: 'ko', requestedRegion: 'KR' })
          .fetchFields({ fields: ['location'] });
        const loc = det?.location;
        if (loc && mapRef.current) {
          mapRef.current.panTo({ lat: loc.lat(), lng: loc.lng() });
        }
        return;
      } catch {}
    }
    const q = pred.description || pred.structured_formatting?.main_text;
    geocoderRef.current?.geocode({ address: q, language: 'ko', region: 'KR' }, (res, st) => {
      if (st === 'OK' && res?.[0]) {
        const loc = res[0].geometry?.location;
        if (loc && mapRef.current) mapRef.current.panTo({ lat: loc.lat(), lng: loc.lng() });
      }
    });
  };

  const showOnMap = (en) => {
    if (!isLoaded) return;
    if (en.lat && en.lng) { setSelectedEntryId(en.id); return; }
    const q = (en.address || en.title || '').trim();
    if (!q || !geocoderRef.current) { setSelectedEntryId(en.id); return; }
    geocoderRef.current.geocode({ address: q, language: 'ko', region: 'KR' }, (res, st) => {
      if (st === 'OK' && res?.[0]) {
        const loc = res[0].geometry?.location;
        if (loc) {
          updateEntry(en.id, { lat: loc.lat(), lng: loc.lng(), address: en.address || res[0].formatted_address });
        }
      }
      setSelectedEntryId(en.id);
    });
  };

  const togglePref = (k) => setPrefs((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  // 저장 전 썸네일 후보 수집: Place.fetchFields만 사용
  const collectPhotoCandidates = async () => {
    const urls = new Set(days.flatMap(d => d.entries.map(en => en.photoUrl).filter(Boolean)));
    const pids = Array.from(new Set(days.flatMap(d => d.entries.map(en => en.placeId).filter(Boolean)))).slice(0, 25);

    const Place = window.google?.maps?.places?.Place;
    const pick = (det) => {
      const p = det?.photos?.[0];
      try { return p?.getURI ? p.getURI({ maxWidth: 640, maxHeight: 480 }) : ''; } catch { return ''; }
    };

    for (const pid of pids) {
      if (urls.size >= 30) break;
      try {
        if (Place) {
          const det = await new Place({ id: normalizePlaceId(pid), requestedLanguage: 'ko', requestedRegion: 'KR' }).fetchFields({ fields: ['photos'] });
          const u = pick(det);
          if (u) urls.add(u);
        }
      } catch {}
    }
    return Array.from(urls);
  };

  const toNotesAndItems = (thumbnailUrl) => {
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
    if (thumbnailUrl) notes.thumbnail_url = thumbnailUrl; // DB notes에만 저장
    return { notes, items };
  };

  const doPersist = async (thumbnailUrl) => {
    if (isReadonly) return;
    if (!token) { setLoginGuard(true); return; }
    if (!title.trim()) return alert('제목을 입력하세요.');
    if (!country.trim() || !region.trim()) return alert('나라와 지역을 입력하세요.');
    if (!start || !end) return alert('날짜를 설정하세요.');

    const { notes, items } = toNotesAndItems(thumbnailUrl);
    const payload = { title, country, region, prefs, start_date: start || null, end_date: end || null, notes, items, is_shared: isShared };

    try {
      if (isEdit) await axios.put(`/api/plans/${planId}`, payload);
      else {
        const { data } = await axios.post('/api/plans', payload);
        if (data?.id) window.location.assign(`/plans/${data.id}`);
        else window.location.assign('/plans');
        return;
      }
      window.location.assign('/plans');
    } catch (e) {
      alert(`저장 실패${e?.response?.data?.error ? `: ${e.response.data.error}` : ''}`);
    }
  };

  return {
    // 상단/폼
    title, setTitle, country, setCountry, region, setRegion,
    prefs, togglePref, PREFS, start, end, handleStartChange, handleEndChange,
    days, setDays, activeIdx, setActiveIdx, isShared, setIsShared,
    loadError, loginGuard, setLoginGuard,

    // 맵/검색
    isLoaded, onMapLoad, onMapUnmount,
    selectedEntryId, setSelectedEntryId,
    mapSearch, setMapSearch, fetchMapPreds, resultsOpen, mapPreds, detailCache,
    panToPred, addPredToCurrentDay, showOnMap,

    // CRUD/DnD
    onDayDragOver, onDayDrop, addEntry, updateEntry, removeEntry, moveEntryUpDown, onDragStart,

    // 저장
    collectPhotoCandidates, doPersist,
  };
}
