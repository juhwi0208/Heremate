// client/src/features/plan/PlanEditor/UsePlanEditor.js
// client/src/features/plan/PlanEditor/UsePlanEditor.js
import { useEffect, useRef, useState, useMemo } from 'react';
import axios from 'axios';
import { useGoogleMapsLoader } from '../../../lib/GoogleMapsLoader';
import UsePlacesAutocomplete from '../../../lib/UsePlacesAutocomplete';
import TravelRegions from '../../../data/TravelRegions';

export const STYLE_OPTIONS = ['자연','맛집','사진','쇼핑','예술','역사','체험','축제','휴식'];
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

const normalizePlaceId = (pid) => {
  if (!pid) return null;
  const s = String(pid);
  return s.startsWith('places/') ? s : `places/${s}`;
};

export default function usePlanEditor({ isEdit, isReadonly, planId, seed }) {
  const token = localStorage.getItem('token');
  const [loginGuard, setLoginGuard] = useState(!isEdit && !token && !isReadonly);

  const { isLoaded } = useGoogleMapsLoader();

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

  const [selectedEntryId, setSelectedEntryId] = useState(null);

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

  const [mapSearch, setMapSearch] = useState('');
  const [mapPreds, setMapPreds] = useState([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [detailCache, setDetailCache] = useState({});

  useEffect(() => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    else delete axios.defaults.headers.common['Authorization'];
  }, [token]);

  // 나라/지역 -> 좌표
  const selectedCoords = useMemo(() => {
    if (!country) return null;
    const c = TravelRegions.find(
      (v) =>
        v.code === country ||
        v.name?.ko === country ||
        v.name?.en === country
    );
    if (!c) return null;

    if (region && Array.isArray(c.cities)) {
      const city = c.cities.find(
        (ci) => ci.ko === region || ci.en === region
      );
      if (city && Number.isFinite(city.lat) && Number.isFinite(city.lng)) {
        return { lat: city.lat, lng: city.lng, radius: 50000 };
      }
    }

    if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
      return { lat: c.lat, lng: c.lng, radius: 120000 };
    }

    return { lat: 37.5665, lng: 126.9780, radius: 120000 };
  }, [country, region]);

  // 자동완성 훅
  const {
    items: autoPredictions,
    loading: autoLoading,
    error: autoError,
    resetSession,
    sessionToken,
  } = UsePlacesAutocomplete({
    query: mapSearch || '',
    lat: selectedCoords?.lat,
    lng: selectedCoords?.lng,
    radius: selectedCoords?.radius || 50000,
    language: 'ko',
    region: 'KR',
    minLength: 2,
    debounceMs: 400,
  });

  // ✅ PlanEditor.js가 기대하는 "검색 호출 함수" (옛날 이름 유지)
  const handleMapSearchChange = (q) => {
    setMapSearch(q);
  };

  // 자동완성 결과를 기존 포맷으로 맞추기
  useEffect(() => {
    if (!mapSearch?.trim()) {
      setMapPreds([]);
      setResultsOpen(false);
      return;
    }
    if (autoLoading) return;

    const norm = (autoPredictions || []).map((p) => {
      const id = p.id || p.place_id;
      const main = p.name || p.displayName?.text || '';
      const secondary = p.formattedAddress || p.address || '';
      return {
        place_id: id,
        description: secondary ? `${main}, ${secondary}` : main,
        structured_formatting: {
          main_text: main,
          secondary_text: secondary,
        },
      };
    });

    setMapPreds(norm);
    setResultsOpen(norm.length > 0);
  }, [mapSearch, autoPredictions, autoLoading]);

  // (이 아래로는 원래 네 파일 로딩/CRUD/DnD/저장 로직 그대로)
  // 여기부터는 네 원래 코드라서 변경 안 함 ————————————————
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

  // 추천 후보 상세 프리패치 (sessionToken도 여기서 쓸 수 있음)
  useEffect(() => {
    const Place = window.google?.maps?.places?.Place;
    if (!Place) return;
    const nextIds = Array.from(new Set(mapPreds.map((p) => p.place_id).filter(Boolean)));

    const fetchWithFallback = async (pid, pred) => {
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
            photoUrl,
          },
        }));
        return;
      } catch {
        // fallthrough
      }

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

      try {
        const fallbackId = normalizePlaceId(v3id || pid);
        const resp = await axios.get('/api/places/details', {
          params: {
            id: fallbackId,
            sessionToken,
          },
        }).catch(() => null);
        const det = resp?.data;
        if (det) {
          const proxiedPhoto =
            det?.photoName
              ? `/api/places/photo?name=${encodeURIComponent(det.photoName)}&w=640&h=480`
              : (det?.photoUrl || '');

          setDetailCache((prev) => ({
            ...prev,
            [pid]: {
              name: det?.displayName?.text || pred?.structured_formatting?.main_text || '',
              address: det?.formattedAddress || pred?.structured_formatting?.secondary_text || '',
              openingHours: det?.regularOpeningHours || null,
              photoUrl: proxiedPhoto,
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
  }, [mapPreds, detailCache, sessionToken]);

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

  const findPlaceAndUpdate = async (entryId, queryOrDetail) => {
    if (!isLoaded) return alert('지도 준비 중입니다. 잠시 후 다시 시도해 주세요.');
    if (queryOrDetail && typeof queryOrDetail === 'object') {
      applyDetailToEntry(entryId, queryOrDetail);
      return;
    }

    const Place = window.google?.maps?.places?.Place;
    const q = String(queryOrDetail || '').trim();
    if (!q) return;

    const lat = selectedCoords?.lat ?? 37.5665;
    const lng = selectedCoords?.lng ?? 126.9780;

    let top = null;
    try {
      const r1 = await axios.get('/api/places/autocomplete', {
        params: { q, lat, lng, sessionToken }
      }).catch(() => null);
      const preds = r1?.data?.predictions || [];
      if (preds.length) top = preds[0];
    } catch {}
    if (!top) {
      try {
        const r2 = await axios.get('/api/places/search', { params: { q, lat, lng, global: 1 } }).catch(() => null);
        const list = r2?.data?.places || [];
        if (list.length) top = list[0];
      } catch {}
    }

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
          resetSession();
          return;
        }
      } catch {}
    }

    const label =
      pred.structured_formatting?.main_text
      || pred.displayName?.text
      || pred.name
      || mapSearch;
    await findPlaceAndUpdate(newId, label);
    setMapSearch(''); setMapPreds([]); setResultsOpen(false);
    resetSession();
  };

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
    if (thumbnailUrl) notes.thumbnail_url = thumbnailUrl;
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
    title, setTitle, country, setCountry, region, setRegion,
    prefs, togglePref, PREFS, start, end, handleStartChange, handleEndChange,
    days, setDays, activeIdx, setActiveIdx, isShared, setIsShared,
    loadError, loginGuard, setLoginGuard,

    isLoaded, onMapLoad, onMapUnmount,
    selectedEntryId, setSelectedEntryId,
    mapSearch, setMapSearch,
    // ✅ 옛날 이름 유지해서 PlanEditor.js 깨지지 않게 함
    fetchMapPreds: handleMapSearchChange,
    resultsOpen, mapPreds, detailCache,
    panToPred, addPredToCurrentDay, showOnMap,

    onDayDragOver, onDayDrop, addEntry, updateEntry, removeEntry, moveEntryUpDown, onDragStart,

    collectPhotoCandidates, doPersist,
  };
}
