// client/src/features/plan/PlanEditor/UsePlanEditor.js
// client/src/features/plan/PlanEditor/UsePlanEditor.js
import { useEffect, useRef, useState, useMemo } from 'react';
import axios from '../../../api/axiosInstance';
import useGoogleMapsLoader from '../../../lib/GoogleMapsLoader';
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

  // 이미 v3이면서 time 문자열이 있는 형태라면 그대로 사용
  if (oh.periods && oh.periods.length && oh.periods[0]?.open?.time) return oh;

  // ✅ v3(day/hour/minute) → v3(time:"HHmm")로 변환
  if (oh.periods && oh.periods.length && (oh.periods[0]?.open?.hour !== undefined || oh.periods[0]?.close?.hour !== undefined)) {
    const pad = (n) => String(n ?? 0).padStart(2, '0');
    const toTime = (obj) => {
      if (!obj) return undefined;
      const hh = pad(obj.hour);
      const mm = pad(obj.minute);
      // 일부 응답은 minute가 없을 수 있음 → "HH00"로 보정
      return `${hh}${mm}`;
    };

    const periods = [];
    for (const p of oh.periods) {
      const od = p.open?.day;
      const cd = (p.close?.day !== undefined) ? p.close.day : p.open?.day;
      const otS = toTime(p.open);
      const ctS = toTime(p.close);

      // ❗시간이 하나라도 없으면 애매한 구간 → 스킵(가짜 00:00 안 만듦)
      if ((od === undefined) || !otS || !ctS) continue;

      periods.push({
        open:  { day: od, time: otS },
        close: { day: (cd ?? od), time: ctS },
      });
    }

    const out = { periods };
    // weekdayDescriptions가 있다면 그대로 보존
    if (Array.isArray(oh.weekdayDescriptions)) out.weekdayDescriptions = oh.weekdayDescriptions;
    return periods.length ? out : (Array.isArray(oh.weekdayDescriptions) ? { weekdayDescriptions: oh.weekdayDescriptions } : null);
  }

  // ✅ v1(openDay/openTime/closeDay/closeTime) → v3(time:"HHmm")
  if (oh.periods && oh.periods.length && (oh.periods[0]?.openDay || oh.periods[0]?.closeDay)) {
    const dayMap = { SUNDAY:0, MONDAY:1, TUESDAY:2, WEDNESDAY:3, THURSDAY:4, FRIDAY:5, SATURDAY:6 };
    const periods = [];
    for (const p of oh.periods) {
      const od = dayMap[p.openDay];
      const cd = dayMap[p.closeDay ?? p.openDay];
      const otS = (p.openTime ?? '').toString().trim();
      const ctS = (p.closeTime ?? '').toString().trim();
      if ((od === undefined) || !otS || !ctS) continue;
      periods.push({
        open:  { day: od, time: otS.padStart(4, '0') },
        close: { day: (cd ?? od), time: ctS.padStart(4, '0') },
      });
    }
    const out = { periods };
    if (Array.isArray(oh.weekdayDescriptions)) out.weekdayDescriptions = oh.weekdayDescriptions;
    return periods.length ? out : (Array.isArray(oh.weekdayDescriptions) ? { weekdayDescriptions: oh.weekdayDescriptions } : null);
  }

  // 변환 불가
  return Array.isArray(oh.weekdayDescriptions) ? { weekdayDescriptions: oh.weekdayDescriptions } : null;
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
              // 1) DB에서 오는 snake_case, 혹은 우발적으로 camelCase로 저장된 경우 둘 다 수용
              const raw =
                (it.openingHours ?? it.opening_hours) ?? null;

              if (!raw) return null;

              // 2) 문자열이면 JSON 파싱
              const parsed = (() => {
                try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
                catch { return null; }
              })();

              // 3) v1 포맷이면 v3 스타일로 정규화
              return normalizeOpeningHours(parsed) || parsed || null;
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
          // 1) DB에서 오는 snake_case, 혹은 우발적으로 camelCase로 저장된 경우 둘 다 수용
          const raw =
            (it.openingHours ?? it.opening_hours) ?? null;

          if (!raw) return null;

          // 2) 문자열이면 JSON 파싱
          const parsed = (() => {
            try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
            catch { return null; }
          })();

          // 3) v1 포맷이면 v3 스타일로 정규화
          return normalizeOpeningHours(parsed) || parsed || null;
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

    let isCancelled = false; // 언마운트/의존성 변경 방지

    // 1) 자동완성에서 온 id들만 대상
    const nextIds = Array.from(
      new Set(
        (mapPreds || [])
          .map((p) => p.place_id)
          .filter(Boolean)
          // ❗ 사진 리소스 경로 같은 건 무시해서 GetPlace 400 방지
          .filter((id) => !String(id).includes('/photos/'))
      )
    );

    // 2) 캐시에 없는 항목만 프리패치
    const targets = nextIds.filter((id) => !detailCache[id]);
    if (!targets.length) return;

    const fetchOne = async (pid, pred) => {
      const normId = pid.startsWith('places/') ? pid : `places/${pid}`;

      try {
        // 1차: JS SDK 디테일
        const place = new Place({
          id: normId,
          requestedLanguage: 'ko',
          requestedRegion: 'KR',
        });

        const det = await place.fetchFields({
          fields: ['id','displayName','formattedAddress','regularOpeningHours','photos'],
        });

        // 사진만 추출 (썸네일은 200px대로 낮춰 초기 로드 빠르게)
        let photoUrl = '';
        const ph = det?.photos?.[0];
        if (ph && typeof ph.getURI === 'function') {
          photoUrl = ph.getURI({ maxWidth: 200, maxHeight: 200 });
        }

        if (!isCancelled) {
          setDetailCache((prev) => ({
            ...prev,
            [pid]: {
              name: det?.displayName?.text || pred?.structured_formatting?.main_text || '',
              address: det?.formattedAddress || pred?.structured_formatting?.secondary_text || '',
              openingHours: det?.regularOpeningHours || null,
              photoUrl,
            },
          }));
        }
      } catch {
        // 2차: 서버 폴백(/api/places/details)
        try {
          const resp = await axios.get('/api/places/details', { params: { id: normId } });
          const det = resp?.data;
          if (!det) return;

          const viaProxy = det?.photoName
            ? `/api/places/photo?name=${encodeURIComponent(det.photoName)}&w=320&h=240`
            : det?.photoUrl || '';

          if (!isCancelled) {
            setDetailCache((prev) => ({
              ...prev,
              [pid]: {
                name: det?.displayName?.text || pred?.structured_formatting?.main_text || '',
                address: det?.formattedAddress || pred?.structured_formatting?.secondary_text || '',
                openingHours: det?.regularOpeningHours || null,
                photoUrl: viaProxy,
              },
            }));
          }
        } catch {
          /* ignore */
        }
      }
    };

    // ✅ 이 안에서만 await 사용 (IIFE)
    (async () => {
      // 상위 후보 6개 우선 병렬 프리패치 → 체감 속도 상승
      const burst = targets.slice(0, 6);
      await Promise.allSettled(
        burst.map((pid) => {
          const pred = (mapPreds || []).find((p) => p.place_id === pid);
          return fetchOne(pid, pred);
        })
      );

      // 남은 후보는 살살(최대 6개)
      const rest = targets.slice(6, 12);
      for (const pid of rest) {
        const pred = (mapPreds || []).find((p) => p.place_id === pid);
        // 느긋하게 처리(굳이 await 안 걸어도 됨)
        fetchOne(pid, pred);
      }
    })();

    return () => { isCancelled = true; };
    // detailCache는 의도적으로 제외 (루프 방지)
  }, [mapPreds]);



  const applyDetailToEntry = (entryId, detail, labelFallback) => {
    const getPhotoUrl = (obj) => {
      const p = obj?.photos?.[0];
      try { return p?.getURI ? p.getURI({ maxWidth: 320, maxHeight: 200 }) : ''; } catch { return ''; }
    };
    updateEntry(entryId, {
      title: detail?.displayName?.text || detail?.name || labelFallback || '',
      address: detail?.formattedAddress || detail?.formatted_address || detail?.vicinity || '',
      lat: detail?.geometry?.location?.lat?.() ?? detail?.location?.lat?.() ?? null,
      lng: detail?.geometry?.location?.lng?.() ?? detail?.location?.lng?.() ?? null,
      placeId: detail?.place_id || detail?.id || null,
      openingHours: (() => {
        const raw =
          detail?.openingHours ??              // 혹시 camel 로도 오는 경우
          detail?.regularOpeningHours ??       // JS SDK v3 정식 필드
          detail?.regular_opening_hours ??     // 서버/레거시 snake
          detail?.opening_hours ??             // 서버/레거시 snake
          null;

        const normalized = normalizeOpeningHours(raw);
        return normalized || raw || null;
      })(),
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

    // 🔁 기존 일정 중 openingHours가 비어 있고 placeId만 있는 항목을 백필
  useEffect(() => {
    // 읽기전용이면 굳이 백필할 필요 없음
    if (isReadonly) return;

    // 스캔: 비어 있는 항목 모으기
    const targets = [];
    days.forEach((d, di) => {
      (d.entries || []).forEach((en) => {
        if (!en.openingHours && en.placeId && !String(en.placeId).includes('/photos/')) {
          targets.push({ di, id: en.id, placeId: en.placeId });
        }
      });
    });
    if (targets.length === 0) return;

    let cancelled = false;
    (async () => {
      // 너무 많이 돌지 않게 10개 정도만 우선 백필
      for (const t of targets.slice(0, 10)) {
        try {
          const pid = t.placeId.startsWith('places/') ? t.placeId : `places/${t.placeId}`;
          const resp = await axios.get('/api/places/details', { params: { id: pid } });
          const det = resp?.data;
          const raw = det?.regularOpeningHours || null;
          if (!raw) continue;

          const fixed = normalizeOpeningHours(raw) || raw;
          if (cancelled || !fixed) continue;

          // state 업데이트
          setDays((prev) => {
            const copy = structuredClone(prev);
            const list = copy[t.di]?.entries || [];
            const idx = list.findIndex((e) => e.id === t.id);
            if (idx >= 0) {
              list[idx].openingHours = fixed;
            }
            return copy;
          });
        } catch {
          /* ignore */
        }
      }
    })();

    return () => { cancelled = true; };
    // days가 바뀔 때마다 새로 스캔하지만, 실제 업데이트는 비어있는 항목에만 반영됨
  }, [days, isReadonly, setDays]);


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

// ✅ 일정에 있는 장소들에서 썸네일 후보 6개 정도 뽑기
const collectPhotoCandidates = async () => {
  const urls = new Set(
    days.flatMap((d) => d.entries.map((en) => en.photoUrl).filter(Boolean))
  );

  const pids = Array.from(
    new Set(
      days
        .flatMap((d) => d.entries.map((en) => en.placeId).filter(Boolean))
    )
  )
    .filter((id) => !String(id).includes('/photos/'))   // ← 이거 한 줄
    .slice(0, 25);

  
  const apiBase = (axios.defaults.baseURL || '').replace(/\/$/, '');

  const Place = window.google?.maps?.places?.Place;
  const pick = (det) => {
    const p = det?.photos?.[0];
    try {
      return p?.getURI ? p.getURI({ maxWidth: 640, maxHeight: 480 }) : '';
    } catch {
      return '';
    }
  };

  for (const pid of pids) {
    if (urls.size >= 30) break;
    try {
      if (Place) {
        const det = await new Place({
          id: pid.startsWith('places/') ? pid : `places/${pid}`,
          requestedLanguage: 'ko',
          requestedRegion: 'KR',
        }).fetchFields({ fields: ['photos'] });

        const u = pick(det);
        if (u) urls.add(u);
        continue;
      }
    } catch {}

    // 서버 폴백
    try {
      const resp = await axios.get('/api/places/details', {
        params: { id: pid.startsWith('places/') ? pid : `places/${pid}` },
      });
      const det = resp?.data;

      let viaProxy = '';
      if (det?.photoName) {
        // ✅ 항상 백엔드 절대주소 + 프록시 경로로 만들기
        viaProxy = `${apiBase}/api/places/photo?name=${encodeURIComponent(
          det.photoName
        )}&w=640&h=480`;
      } else if (det?.photoUrl) {
        // det.photoUrl 이 /api/... 처럼 상대경로라면 baseURL 붙여줌
        viaProxy = det.photoUrl.startsWith('/')
          ? `${apiBase}${det.photoUrl}`
          : det.photoUrl;
      }

      if (viaProxy) urls.add(viaProxy);
    } catch {}
  }

  return Array.from(urls).slice(0, 6);
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
    const payload = { title, country, region, prefs, start_date: start || null, end_date: end || null, notes: JSON.stringify(notes), items, is_shared: isShared };

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
