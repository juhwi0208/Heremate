// client/src/features/plan/pages/PlanEditor.js
// 지도 상단 검색 1곳 + 후보 패널 + 일정에 추가
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import axios from '../../../api/axiosInstance';
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

function pickLatLng(loc) {
  if (!loc) return null;
  // Case A: google.maps.LatLng 인스턴스
  if (typeof loc.lat === 'function' && typeof loc.lng === 'function') {
    return { lat: Number(loc.lat()), lng: Number(loc.lng()) };
  }
  // Case B: {latLng: google.maps.LatLng}
  if (loc.latLng && typeof loc.latLng.lat === 'function') {
    return { lat: Number(loc.latLng.lat()), lng: Number(loc.latLng.lng()) };
  }
  // Case C: {lat: number, lng: number}
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    return { lat: Number(loc.lat), lng: Number(loc.lng) };
  }
  return null;
}


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

// 신형/구형 모두를 { periods: [{ open:{day,time:'HHMM'}, close:{day,time:'HHMM'} }]}로 정규화
function normalizeOpeningHours(src) {
  if (!src) return null;
  try {
    const base = src.regularOpeningHours || src; // 신형이면 regularOpeningHours, 아니면 그대로
    const toHHMM = (x) => {
      if (!x) return '0000';
      if (typeof x.time === 'string') return x.time;           // 구형처럼 'HHMM'
      const h = String(x.hour ?? 0).padStart(2, '0');           // 신형: {hour, minute}
      const m = String(x.minute ?? 0).padStart(2, '0');
      return `${h}${m}`;
    };
    const periods = (base.periods || []).map((p) => ({
      open:  p.open  ? { day: p.open.day,  time: toHHMM(p.open)  } : undefined,
      close: p.close ? { day: p.close.day, time: toHHMM(p.close) } : undefined,
    }));
    return periods.length ? { periods } : null;
  } catch {
    return null;
  }
}


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

  // 상단 폼 상태
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
  const [mapCenter, setMapCenter] = useState({ lat: 37.5665, lng: 126.9780 });
  const [mapZoom, setMapZoom] = useState(12);

  // 구글맵
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_LIBRARIES,
    version: 'weekly', 
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

  // 🔹 후보 '지도에 표시'용 임시 핀 (선택된 일정 마커가 없을 때 표시)
  const [tempPin, setTempPin] = useState(null);

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

  // ✅ 선택된 일정이 바뀌면 지도 중심도 따라가도록 동기화
  useEffect(() => {
    if (selectedEntry?.lat && selectedEntry?.lng) {
      const pt = { lat: Number(selectedEntry.lat), lng: Number(selectedEntry.lng) };
      setMapCenter(pt);
      // 보기 좋게 살짝 확대(이미 더 크면 유지)
      setMapZoom((z) => (z < 14 ? 14 : z));
    }
  }, [selectedEntry]);    

  

  // 편집 로드
  useEffect(() => {
    if (!isEdit) return setLoading(false);
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const url = isReadonly ? `/api/plans/${id}/readonly` : `/api/plans/${id}`;
        const { data: p } = await axios.get(url);

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
  }, [id, isEdit, isReadonly]);

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
          try {
            const raw = typeof it.opening_hours === 'string' ? JSON.parse(it.opening_hours) : it.opening_hours;
            return normalizeOpeningHours(raw);
          } catch { return null; }
        })(),
      });
    });
    const want = rangeDates(s, e);
    const arrDays = want.map((d) => grouped[d] || { date: d, note: notes[d] || '', entries: [] });
    setDays(arrDays);
    setActiveIdx(0);
  }, [isEdit, seed]);

  // 날짜 변경 가드
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

  // 일정 CRUD
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

  // 기존 엔트리 업데이트 함수 (세부 결과를 받아 엔트리 채움)
  const findPlaceAndUpdate = async (entryId, queryOrDetail) => {
    if (!isLoaded) return alert('지도 준비 중입니다. 잠시 후 다시 시도해 주세요.');
    const ac  = autocompleteRef.current;
    const svc = placesSvcRef.current;
    const gc  = geocoderRef.current;

    // findPlaceAndUpdate 안에 있는 apply를 아래로 교체
    const apply = (r, options = {}) => {
      // --- 내부 헬퍼: 위치/영업시간/사진 안전 추출 ---
      const pickLatLng = (loc) => {
        if (!loc) return null;
        // A) google.maps.LatLng 인스턴스
        if (typeof loc.lat === 'function' && typeof loc.lng === 'function') {
          return { lat: Number(loc.lat()), lng: Number(loc.lng()) };
        }
        // B) { latLng: google.maps.LatLng }
        if (loc.latLng && typeof loc.latLng.lat === 'function') {
          return { lat: Number(loc.latLng.lat()), lng: Number(loc.latLng.lng()) };
        }
        // C) { lat: number, lng: number }
        if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          return { lat: Number(loc.lat), lng: Number(loc.lng) };
        }
        return null;
      };

      const normalizeOpeningHours = (oh) => {
        try {
          const src = oh?.regularOpeningHours || oh;
          const periods = (src?.periods || []).map((p) => {
            const toHHMM = (x) => {
              if (!x) return '0000';
              if (typeof x.time === 'string') return x.time; // 이미 'HHMM'
              const h = String(x.hour ?? 0).padStart(2, '0');
              const m = String(x.minute ?? 0).padStart(2, '0');
              return `${h}${m}`;
            };
            return {
              open: { day: p.open?.day, time: toHHMM(p.open) },
              close: p.close ? { day: p.close?.day, time: toHHMM(p.close) } : undefined,
            };
          });
          return { periods };
        } catch { return oh || null; }
      };

      const pickPhotoUrl = (res) => {
        try {
          const p = res?.photos?.[0];
          if (!p) return '';
          if (typeof p.getURL === 'function') return p.getURL({ maxWidth: 640, maxHeight: 480 }); // 신형
          if (typeof p.getUrl === 'function') return p.getUrl({ maxWidth: 640, maxHeight: 480 }); // 구형
          return '';
        } catch { return ''; }
      };

      // --- 옵션(수동 override) 우선 ---
      const {
        title: optTitle,
        address: optAddress,
        lat: optLat,
        lng: optLng,
        placeId: optPlaceId,
        openingHours: optOH,
        photoUrl: optPhotoUrl,
      } = options;

      // ✅ 제목: 구글 “공식명” 우선 (신형 → 구형 → prediction 보조), 검색어는 쓰지 않음
      const title =
        optTitle ??
        r.displayName?.text ??
        r.name ??
        r.structured_formatting?.main_text ??
        '';

      // ✅ 주소: 신형/구형 → prediction 보조 → 없으면 빈 문자열
      const address =
        optAddress ??
        r.formattedAddress ??
        r.formatted_address ??
        r.vicinity ??
        r.structured_formatting?.secondary_text ??
        r.description ??
        '';

      const placeId = optPlaceId ?? r.place_id ?? r.id ?? null;

      // 위치: 옵션 → 신형/구형 location → geometry.location
      let lat = typeof optLat === 'number' ? optLat : null;
      let lng = typeof optLng === 'number' ? optLng : null;
      if (lat == null || lng == null) {
        const picked = pickLatLng(r.location) || pickLatLng(r.geometry?.location);
        if (picked) { lat = picked.lat; lng = picked.lng; }
      }

      // 영업시간 정규화
      const rawOH = optOH ?? r.regularOpeningHours ?? r.opening_hours ?? null;
      const openingHours = normalizeOpeningHours(rawOH);

      const photoUrl = optPhotoUrl ?? pickPhotoUrl(r);

      // --- 최종 반영 ---
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
        ac.getPlacePredictions({ 
          input: queryOrDetail, 
          language: 'ko', 
          region: 'KR', 
          sessionToken: tokenObj 
        }, (preds, status) => {
          if (status !== 'OK' || !preds?.length) return resolve({ ok:false });
          
          const pred = preds[0];
          const pid = pred.place_id;
          
          const fetchFromPred = () => {
            if (Place) {
              (async () => {
                try {
                  const place = new Place({ id: pid, requestedLanguage: 'ko', requestedRegion: 'KR' });
                  await place.fetchFields({ fields: ['id','displayName','formattedAddress','location','regularOpeningHours','photos','geometry','name','place_id','opening_hours'] });
                  apply(place);
                  return resolve({ ok:true });
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
          
          fetchFromPred();
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
            openingHours: normalizeOpeningHours(top?.regularOpeningHours || null),

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
    if (!localStorage.getItem('token')) return alert('로그인이 필요합니다.');
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

  // 지도 센터 동기화
  /*
  useEffect(() => {
    if (!mapRef.current || !selectedEntry?.lat || !selectedEntry?.lng) return;
    mapRef.current.panTo({ lat: Number(selectedEntry.lat), lng: Number(selectedEntry.lng) });
  }, [selectedEntry]); 
  */

  

  const togglePref = (k) =>
    setPrefs((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const Bubble = ({ children }) => (
    <div className="relative my-2">
      <div className="inline-block bg-zinc-200 text-zinc-700 text-xs px-3 py-2 rounded-2xl shadow-sm">{children}</div>
      <div className="absolute -bottom-2 left-4 w-0 h-0 border-l-6 border-r-6 border-t-6 border-l-transparent border-r-transparent border-t-zinc-200" />
    </div>
  );

  // 지도 오버레이 검색: 입력 → 예측 → 텍스트/지오코드 폴백
  const fetchMapPreds = (q) => {
    setMapSearch(q);
    if (!q) { setMapPreds([]); setResultsOpen(false); return; }

    const ac  = autocompleteRef.current;
    const svc = placesSvcRef.current;
    const gc  = geocoderRef.current;
    const token = sessionTokenRef.current;

    const toPredCards = (arr) => {
      // TextSearch/Geocode 결과를 오버레이 카드용 "유사 프레딕션"으로 변환
      return (arr || []).map((r) => ({
        place_id: r.place_id || r.id || null,
        description: r.name || r.formatted_address || r.formattedAddress || '',
        structured_formatting: {
          main_text: r.displayName?.text || r.name || r.structured_formatting?.main_text || '',
          secondary_text: r.formattedAddress || r.formatted_address || r.vicinity || r.structured_formatting?.secondary_text || ''
        }
      }));
    };

    const show = (list) => {
      const sliced = (list || []).slice(0, 8);
      setMapPreds(sliced);
      // 🔸 입력중이 아니어도 검색어가 존재하면 계속 보여줌
      setResultsOpen(((mapSearch || '').trim().length > 0) && sliced.length > 0);
    };

    const doAutocomplete = () => new Promise((resolve) => {
      if (!ac) return resolve(false);
      ac.getPlacePredictions({ input: q, language: 'ko', region: 'KR', sessionToken: token }, (list, status) => {
        if (status === 'OK' && Array.isArray(list) && list.length) { show(list); return resolve(true); }
        resolve(false);
      });
    });

    const doTextSearch = () => new Promise((resolve) => {
      if (!svc?.textSearch) return resolve(false);
      svc.textSearch({ query: q, language: 'ko', region: 'KR' }, (res, st) => {
        if (st === 'OK' && Array.isArray(res) && res.length) { show(toPredCards(res)); return resolve(true); }
        resolve(false);
      });
    });

    const doGeocode = () => new Promise((resolve) => {
      if (!gc) return resolve(false);
      gc.geocode({ address: q, language: 'ko', region: 'KR' }, (res, st) => {
        if (st === 'OK' && Array.isArray(res) && res.length) { show(toPredCards(res)); return resolve(true); }
        resolve(false);
      });
    });

    (async () => {
      if (await doAutocomplete()) return;
      
      // ✅ 신형 Places HTTP(서버 프록시) 폴백
      const doServerSearch = async () => {
        try {
          const resp = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
          if (!resp.ok) return false;
          const json = await resp.json();

          // 서버 응답(Places API New Text Search)을 "유사 프레딕션" 카드로 변환
          const preds = (json?.places || []).map((r) => ({
            place_id: r.id || r.place_id || null,
            description: r.displayName?.text || r.formattedAddress || '',
            structured_formatting: {
              main_text: r.displayName?.text || r.name || '',
              secondary_text: r.formattedAddress || r.vicinity || '',
            },
          }));

          if (preds.length) { show(preds); return true; }
          return false;
        } catch {
          return false;
        }
      };
      if (await doServerSearch()) return; 
      if (await doTextSearch())  return;
      if (await doGeocode())     return;
      setMapPreds([]); setResultsOpen(false);
    })();
  };

  // 후보 리스트가 바뀌면 (사진/주소/영업시간) 미리 캐시
  useEffect(() => {
    const svc = placesSvcRef.current;
    const Place = window.google?.maps?.places?.Place;
    const nextIds = new Set(mapPreds.map((p) => p.place_id).filter(Boolean));
    nextIds.forEach((pid) => {
      if (detailCache[pid]) return;
      (async () => {
      // 1) 신형 Place.fetchFields() 시도
        if (Place) {
          try {
            const place = new Place({ id: pid, requestedLanguage: 'ko', requestedRegion: 'KR' });
            await place.fetchFields({ fields: ['formattedAddress','regularOpeningHours','photos'] });
            const p = place.photos?.[0];
            const photoUrl =
              (p?.getURI?.({ maxWidth: 400, maxHeight: 300 })) ||
              (p?.getUrl?.({ maxWidth: 400, maxHeight: 300 })) || '';
            setDetailCache((prev) => ({
              ...prev,
              [pid]: {
                address: place.formattedAddress || '',
                openingHours: normalizeOpeningHours(place.regularOpeningHours || null),
                photoUrl,
              },
            }));
            return;
          } catch {}
        }

        // 2) 구형 getDetails 폴백 (가능한 환경만)
        if (svc?.getDetails) {
          return svc.getDetails(
            { placeId: pid, fields: ['formatted_address','opening_hours','photos'] },
            (det, st) => {
              if (st !== window.google.maps.places.PlacesServiceStatus.OK || !det) return;
              const p = det.photos?.[0];
              let photoUrl = '';
              try { photoUrl = p?.getUrl ? p.getUrl({ maxWidth: 400, maxHeight: 300 }) : ''; } catch {}
              setDetailCache((prev) => ({
                ...prev,
                [pid]: {
                  address: det.formatted_address || '',
                 openingHours: normalizeOpeningHours(det.opening_hours || null),

                  photoUrl,
                },
              }));
            }
          );
        }

        // 3) 서버 폴백 (신형 HTTP)
        try {
          const resp = await fetch(`/api/places/details?id=${encodeURIComponent(pid)}`);
          if (resp.ok) {
            const det = await resp.json();
            setDetailCache((prev) => ({
              ...prev,
              [pid]: {
                address: det?.formattedAddress || '',
                openingHours: det?.regularOpeningHours || null,
                photoUrl: det?.photoUrl || '',
              },
            }));
          }
        } catch {}
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapPreds]);

  // 후보 → 현재 Day에 추가 (시간 비움, 제목=정확한 장소명)
  const addPredToCurrentDay = async (pred) => {
    if (isReadonly) return;
    const newId = addEntry();
    const pid = pred?.place_id;
    const Place = window.google?.maps?.places?.Place;

    // 1) New Places 경로 (권장)
    if (pid && Place) {
      try {
        const place = new Place({ id: pid, requestedLanguage: 'ko', requestedRegion: 'KR' });
        await place.fetchFields({
          fields: ['id','displayName','formattedAddress','location','regularOpeningHours','photos','name','place_id']
        });
        await findPlaceAndUpdate(newId, place);

        setMapSearch('');
        setMapPreds([]);
        setResultsOpen(false);
        setTempPin(null);
        return; // 성공 시 여기서 종료
      } catch (e) {
        // 실패 시 레거시로 폴백 (아래로 진행)
      }
    }

    // 2) 레거시 PlacesService 경로 (폴백)
    if (pid && placesSvcRef.current?.getDetails) {
      return placesSvcRef.current.getDetails(
        { placeId: pid, fields: ['name','formatted_address','geometry','place_id','opening_hours','photos'] },
        async (det, st) => {
          if (st === window.google.maps.places.PlacesServiceStatus.OK && det) {
            await findPlaceAndUpdate(newId, det);
          } else {
            const label = pred.structured_formatting?.main_text || pred.description || mapSearch;
            await findPlaceAndUpdate(newId, label);
          }
          setMapSearch('');
          setMapPreds([]);
          setResultsOpen(false);
          setTempPin(null);
        }
      );
    }

    // 3) 최종 폴백 (pid 없거나 둘 다 실패)
    const label = pred.structured_formatting?.main_text || pred.description || mapSearch;
    await findPlaceAndUpdate(newId, label);
    setMapSearch('');
    setMapPreds([]);
    setResultsOpen(false);
    setTempPin(null);
  };

  // panToPred를 아래 형태로 수정 (핵심: setMapCenter / setMapZoom도 호출)
  // panToPred를 아래 형태로 교체
  const panToPred = async (pred) => {
    const Place = window.google?.maps?.places?.Place;
    const pid = pred?.place_id;

    // 위치 파서(apply의 것과 동일)
    const pickLatLng = (loc) => {
      if (!loc) return null;
      if (typeof loc.lat === 'function' && typeof loc.lng === 'function') {
        return { lat: Number(loc.lat()), lng: Number(loc.lng()) };
      }
      if (loc.latLng && typeof loc.latLng.lat === 'function') {
        return { lat: Number(loc.latLng.lat()), lng: Number(loc.latLng.lng()) };
      }
      if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return { lat: Number(loc.lat), lng: Number(loc.lng) };
      }
      return null;
    };

    // 1) 신형 Place → location
    if (Place && pid) {
      try {
        const place = new Place({ id: pid, requestedLanguage: 'ko', requestedRegion: 'KR' });
        await place.fetchFields({ fields: ['location'] });
        const pt = pickLatLng(place?.location);
        if (pt) {
          // ✅ panTo + state(center/zoom) 동기화
          setMapCenter?.(pt);
          setMapZoom?.(15);
          mapRef.current?.panTo(pt);
          setTempPin(pt);
          setSelectedEntryId?.(null);
          return;
        }
      } catch {}
    }

    // 2) 서버 상세 폴백
    if (pid) {
      try {
        const r = await fetch(`/api/places/details?id=${encodeURIComponent(pid)}`);
        if (r.ok) {
          const det = await r.json();
          const pt = det?.location
            ? { lat: Number(det.location.latitude), lng: Number(det.location.longitude) }
            : null;
          if (pt) {
            setMapCenter?.(pt);
            setMapZoom?.(15);
            mapRef.current?.panTo(pt);
            setTempPin(pt);
            setSelectedEntryId?.(null);
            return;
          }
        }
      } catch {}
    }

    // 3) 지오코더 최후의 수단
    const q = pred?.structured_formatting?.main_text || pred?.description;
    geocoderRef.current?.geocode({ address: q, language: 'ko', region: 'KR' }, (res, st) => {
      if (st === 'OK' && res?.[0]) {
        const loc = res[0].geometry?.location;
        if (loc) {
          const pt = { lat: loc.lat(), lng: loc.lng() };
          setMapCenter?.(pt);
          setMapZoom?.(15);
          mapRef.current?.panTo(pt);
          setTempPin(pt);
          setSelectedEntryId?.(null);
        }
      }
    });
  };



  // 일정에서 "지도 표시"
  // showOnMap을 아래 형태로 교체
  const showOnMap = (en) => {
    if (!isLoaded) return;

    // 좌표가 이미 있으면 곧바로 팬 + 확대 + 상태 동기화
    if (en.lat && en.lng) {
      const pt = { lat: Number(en.lat), lng: Number(en.lng) };
      setMapCenter?.(pt);
      setMapZoom?.(15);
      mapRef.current?.panTo(pt);
      setTempPin(pt);
      setSelectedEntryId(en.id);
      return;
    }

    // 좌표가 없으면 주소로 지오코딩 후 업데이트 + 이동
    const q = (en.address || en.title || '').trim();
    if (!q || !geocoderRef.current) {
      setSelectedEntryId(en.id);
      return;
    }

    geocoderRef.current.geocode({ address: q, language: 'ko', region: 'KR' }, (res, st) => {
      if (st === 'OK' && res?.[0]) {
        const loc = res[0].geometry?.location;
        if (loc) {
          const pt = { lat: loc.lat(), lng: loc.lng() };
          // DB/상태 업데이트
          updateEntry(en.id, {
            lat: pt.lat,
            lng: pt.lng,
            address: en.address || res[0].formatted_address,
          });
          // 지도 이동 + 확대 + 핀 + 선택
          setMapCenter?.(pt);
          setMapZoom?.(15);
          mapRef.current?.panTo(pt);
          setTempPin(pt);
        }
      }
      setSelectedEntryId(en.id);
    });
  };


  // 영업시간 경고 표시용 (각 엔트리별 즉시 검증) - 수정된 부분
  const openingWarning = (en, dateStr) => {
    if (!en.time) return null;
    if (isWithinOpening(en.openingHours, dateStr, en.time)) return null;
    return (
      <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
        <span className="text-red-500">⚠️</span>
        <span>이 시간은 운영시간이 아니에요!</span>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* 상단 타이틀 + 액션 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-green-700">{isReadonly ? '여행 계획(읽기 전용)' : '여행 계획 보드'}</h2>
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
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loadError}</div>
      )}

      {/* 상단 기본정보 */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div>
          <div className="text-xs mb-1">여행 제목</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" disabled={isReadonly}/>
        </div>
        <div>
          <div className="text-xs mb-1">나라</div>
          <input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" disabled={isReadonly}/>
        </div>
        <div>
          <div className="text-xs mb-1">지역/도시</div>
          <input value={region} onChange={(e) => setRegion(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" disabled={isReadonly}/>
        </div>
        <div>
          <div className="text-xs mb-1">출발일</div>
          <input type="date" value={start} onChange={(e) => handleStartChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" disabled={isReadonly}/>
        </div>
        <div>
          <div className="text-xs mb-1">도착일</div>
          <input type="date" value={end} onChange={(e) => handleEndChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" disabled={isReadonly}/>
        </div>
        <div>
          <div className="text-xs mb-1">취향</div>
          <div className="flex flex-wrap gap-2">
            {ALL_PREFS.map((p) => (
              <button
                key={p.key}
                onClick={() => !isReadonly && togglePref(p.key)}
                className={`px-3 py-1 rounded-full text-xs ${prefs.includes(p.key) ? 'bg-green-600 text-white' : 'bg-zinc-100 text-zinc-700'}`}
                disabled={isReadonly}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 본문 2열: 좌(스케줄), 우(지도+검색) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 좌측 스케줄 */}
        <div>
          {days.map((d, i) => (
            <div
              key={d.date}
              onDragOver={onDayDragOver(i)}
              onDrop={onDayDrop(i)}
              className={`border rounded-xl p-4 mb-3 ${i === activeIdx ? 'border-green-500 ring-1 ring-green-200' : 'border-zinc-200'}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">Day {i + 1} <span className="text-xs text-zinc-500 ml-1">{d.date}</span></div>
                <div className="flex items-center gap-2">
                  {!isReadonly && (
                    <button onClick={() => { setActiveIdx(i); const id = addEntry(); setSelectedEntryId(id); }} className="px-2 py-1 text-xs rounded bg-zinc-100">+ 일정 추가</button>
                  )}
                  <button onClick={() => setActiveIdx(i)} className="px-2 py-1 text-xs rounded border">선택</button>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {d.entries.map((en, idx) => (
                  <div key={en.id} className={`border rounded-lg p-3 ${selectedEntryId === en.id ? 'border-green-400 bg-green-50' : 'border-zinc-200'}`}>
                    <div className="grid grid-cols-[80px,1fr] gap-3 items-start">
                      {/* 시간 */}
                      <div>
                        <div className="text-[11px] text-zinc-500 mb-1">시간</div>
                        <select
                          value={en.time}
                          onChange={(e) => updateEntry(en.id, { time: e.target.value })}
                          disabled={isReadonly}
                          className="w-full border rounded px-2 py-1 text-sm"
                        >
                          <option value="">--</option>
                          {times30m.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>

                      {/* 장소 제목/주소/설명 */}
                      <div className="min-w-0">
                        <div className="text-[11px] text-zinc-500 mb-1">제목(장소명)</div>
                        <input
                          value={en.title || ''}
                          onChange={(e) => updateEntry(en.id, { title: e.target.value })}
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="장소명"
                          disabled={isReadonly}
                        />
                        <div className="mt-2 text-[11px] text-zinc-500">주소</div>
                        <input
                          value={en.address || ''}
                          onChange={(e) => updateEntry(en.id, { address: e.target.value })}
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="주소"
                          disabled={isReadonly}
                        />
                        {/* 영업시간 경고 */}
                        {openingWarning(en, d.date)}
                      </div>
                    </div>

                    {/* 액션들 */}
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={() => showOnMap(en)} className="px-2 py-1 text-xs rounded border">지도 표시</button>
                      {!isReadonly && (
                        <>
                          <button onClick={() => moveEntryUpDown(en.id, -1)} className="px-2 py-1 text-xs rounded bg-zinc-100">↑</button>
                          <button onClick={() => moveEntryUpDown(en.id, +1)} className="px-2 py-1 text-xs rounded bg-zinc-100">↓</button>
                          <button onClick={() => removeEntry(en.id)} className="px-2 py-1 text-xs rounded bg-rose-50 text-rose-600 border border-rose-200">삭제</button>
                        </>
                      )}
                    </div>

                    {/* 사용자에게 보이면 안되는 placeId는 UI에 절대 표시하지 않음 */}
                    {/* (DB 저장은 내부에서 계속 처리) */}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 우측: 지도 + 검색 */}
        <div>
          <div className="mb-2">
            <div className="text-xs mb-1">지도에서 장소 찾기</div>
            <input
              value={mapSearch}
              onChange={(e) => fetchMapPreds(e.target.value)}
              onFocus={() => setResultsOpen(Boolean((mapSearch || '').trim()))}
              placeholder="장소명을 입력하세요 (예: 디즈니랜드)"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <Bubble>검색하면 아래 카드로 후보가 떠요. "일정추가"를 누르면 현재 Day에 들어갑니다.</Bubble>
          </div>

          <div className="rounded-xl overflow-hidden border h-[360px]">
            {isLoaded ? (
              <GoogleMap
                onLoad={(m) => { mapRef.current = m; }}
                onUnmount={() => { mapRef.current = null; }}
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={mapZoom}
                options={{
                  fullscreenControl: false,
                  streetViewControl: false,
                  mapTypeControl: false,
                  zoomControl: true,
                  gestureHandling: 'greedy',
                }}
                onClick={() => { setResultsOpen(false); }}
              >
                {/* 선택된 일정 핀 */}
                {selectedEntry?.lat && selectedEntry?.lng && (
                  <Marker position={{ lat: Number(selectedEntry.lat), lng: Number(selectedEntry.lng) }} />
                )}
                {/* 후보 "지도보기" 임시핀 */}
                {tempPin && !(selectedEntry?.lat && selectedEntry?.lng) && (
                  <Marker position={{ lat: tempPin.lat, lng: tempPin.lng }} />
                )}
              </GoogleMap>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">구글맵 로드 중…</div>
            )}
          </div>

          {/* 지도 아래: 검색된 장소 후보 목록 */}
          {resultsOpen && mapPreds.length > 0 && (
            <div className="mt-3 space-y-2">
              {mapPreds.map((p) => {
                const det = detailCache[p.place_id] || {}; // { photoUrl, address, openingHours }
                const placeName = p.structured_formatting?.main_text || p.description;
                const placeAddress = det.address || p.structured_formatting?.secondary_text;
                
                return (
                  <div key={p.place_id} className="border rounded-xl bg-white p-3">
                    <div className="flex gap-3">
                      {/* 사진 썸네일 */}
                      {det.photoUrl ? (
                        <img
                          src={det.photoUrl}
                          alt="thumb"
                          className="w-16 h-16 rounded object-cover flex-none"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded bg-zinc-100 grid place-items-center text-[11px] text-zinc-400 flex-none">
                          NO IMG
                        </div>
                      )}

                      {/* 텍스트 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {placeName}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          {placeAddress}
                        </div>
                        {det.openingHours && (
                          <div className="text-[11px] text-zinc-400 mt-1">
                            {summarizeTodayHours(det.openingHours)}
                          </div>
                        )}

                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => addPredToCurrentDay(p)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            일정추가
                          </button>
                          <button
                            onClick={() => panToPred(p)}
                            className="px-3 py-1.5 text-xs rounded-lg border"
                          >
                            지도보기
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
      </div> {/* /본문 2열 */}

      {/* 날짜 축소 모달 (생략 가능: 기존 로직 유지) */}
      {dateChangeAsk && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-5 py-4 border-b">
              <div className="text-lg font-semibold">줄어든 날짜에 맞게 삭제할 Day 선택</div>
              <div className="mt-1 text-sm text-zinc-600">
                새 기간에 맞추기 위해 {dateChangeAsk.defaultDrop.size}개의 Day를 제거해야 합니다.
              </div>
            </div>
            {/* …필요 시 기존 모달 내부 구현 유지… */}
          </div>
        </div>
      )}
    </div>
  );
}