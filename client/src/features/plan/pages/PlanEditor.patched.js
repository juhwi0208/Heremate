// client/src/features/plan/pages/PlanEditor.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// === PATCH: helpers & constants (UI 영향 없음) ===
const DAY_MS = 24 * 60 * 60 * 1000;
const genId = () => (crypto?.randomUUID ? crypto.randomUUID() : 'id_' + Math.random().toString(36).slice(2));

const hhmmToNum = (s) => (s && s.length === 5 ? parseInt(s.slice(0,2)+s.slice(3,5), 10) : null);
const hhmm4ToDisp = (s) => (s && s.length === 4 ? `${s.slice(0,2)}:${s.slice(2,4)}` : s || '');

function isTimeWithinOpeningHours(opening_hours, dateISO, hhmm) {
  if (!opening_hours?.periods || !hhmm) return true; // 정보 없으면 경고 안띄움
  const weekday = new Date(dateISO).getDay(); // 0~6
  const t = hhmmToNum(hhmm);
  if (t == null) return true;
  return opening_hours.periods.some(p => {
    if (!p.open || !p.close) return false;
    const od = p.open.day, cd = p.close.day;
    const ot = parseInt(p.open.time, 10), ct = parseInt(p.close.time, 10);
    if (od === cd) return (od === weekday) && t >= ot && t < ct;
    if (od === weekday && t >= ot) return true;      // overnight (open today → close tomorrow)
    if (cd === weekday && t <  ct) return true;      // overnight (open yesterday → close today)
    return false;
  });
}

function hoursSummary(opening_hours, dateISO) {
  if (!opening_hours?.periods?.length) return '영업시간 정보 없음';
  const weekday = new Date(dateISO).getDay();
  const todays = opening_hours.periods.filter(p => {
    if (!p.open || !p.close) return false;
    return p.open.day === weekday || p.close.day === weekday;
  });
  if (!todays.length) return '오늘 휴무';
  const parts = todays.map(p => `${hhmm4ToDisp(p.open?.time)}–${hhmm4ToDisp(p.close?.time)}${p.open?.day!==p.close?.day?' (익일)':''}`);
  return `오늘 영업: ${parts.join(', ')}`;
}


/**
 * ✅ 요구사항
 * - 기존 UI/UX 및 기존 데이터/기능(제목/나라/지역/날짜/취향/Day 자동생성/메모/일정 등) 유지
 * - 지도 상단 검색창 1개만 사용(스케줄 내부 검색칸 제거)
 * - 입력 중에만 후보 패널, 비거나 blur 시 자동 숨김
 * - 후보: 사진/영업시간/주소/"일정에 추가"
 * - "일정에 추가" → 현재 Day에 시간 비어있는 상태로 추가(장소명/주소/좌표/PlaceID/영업시간 포함)
 * - 시간 설정 시 운영시간 밖이면 빨간 경고문구(❗ 이 시간은 운영시간이 아니에요!)
 * - Drag & Drop: Day 내 재정렬 + Day 간 이동
 * - 지도 Street View(노란사람) 비활성화
 * - 날짜 범위를 줄일 때 잘려나갈 Day에 일정이 있으면 [삭제/이동/취소] 선택지 제공
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const genId = () => (crypto?.randomUUID ? crypto.randomUUID() : 'id_' + Math.random().toString(36).slice(2));

const hhmmToNum = (s) => (s && s.length === 5 ? parseInt(s.slice(0, 2) + s.slice(3, 5), 10) : null);
const hhmm4ToDisp = (s) => (s && s.length === 4 ? `${s.slice(0, 2)}:${s.slice(2, 4)}` : s || '');

function isTimeWithinOpeningHours(opening_hours, dateISO, hhmm) {
  if (!opening_hours?.periods || !hhmm) return true;
  const weekday = new Date(dateISO).getDay(); // 0~6
  const t = hhmmToNum(hhmm);
  if (t == null) return true;
  return opening_hours.periods.some((p) => {
    if (!p.open || !p.close) return false;
    const od = p.open.day, cd = p.close.day;
    const ot = parseInt(p.open.time, 10), ct = parseInt(p.close.time, 10);
    if (od === cd) return od === weekday && t >= ot && t < ct;
    if (od === weekday && t >= ot) return true; // overnight
    if (cd === weekday && t < ct) return true; // overnight
    return false;
  });
}

function hoursSummary(opening_hours, dateISO) {
  if (!opening_hours?.periods?.length) return '영업시간 정보 없음';
  const weekday = new Date(dateISO).getDay();
  const todays = opening_hours.periods.filter((p) => p.open && p.close && (p.open.day === weekday || p.close.day === weekday));
  if (!todays.length) return '오늘 휴무';
  const parts = todays.map((p) => `${hhmm4ToDisp(p.open?.time)}–${hhmm4ToDisp(p.close?.time)}${p.open?.day !== p.close?.day ? ' (익일)' : ''}`);
  return `오늘 영업: ${parts.join(', ')}`;
}

function makeDays(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const s = new Date(startDate);
  const e = new Date(endDate);
  const out = [];
  for (let ts = s.getTime(); ts <= e.getTime(); ts += DAY_MS) {
    const d = new Date(ts);
    out.push({ id: genId(), date: d.toISOString().slice(0, 10), memo: '', entries: [] });
  }
  return out;
}

/** 지도 검색 훅 (UI 영향 없음) */
function useMapSearch(mapObjRef) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cands, setCands] = useState([]); // {placeId, name, address, photoUrl, geometry, opening_hours}
  const sessionTokenRef = useRef(null);
  const panelRef = useRef(null);
  const boxRef = useRef(null);
  const blurTimerRef = useRef(null);

  const prefetchDetails = useCallback(async (placeIds) => {
    const g = window.google;
    if (!g?.maps || !mapObjRef.current) return [];
    const svc = new g.maps.places.PlacesService(mapObjRef.current);
    const fields = ['place_id', 'name', 'formatted_address', 'geometry', 'photos', 'opening_hours'];
    const runOne = (pid) =>
      new Promise((res) => {
        svc.getDetails({ placeId: pid, fields, language: 'ko', region: 'KR' }, (d, st) => {
          if (st === g.maps.places.PlacesServiceStatus.OK && d) {
            res({
              placeId: d.place_id,
              name: d.name,
              address: d.formatted_address,
              geometry: d.geometry?.location ? { lat: d.geometry.location.lat(), lng: d.geometry.location.lng() } : null,
              photoUrl: d.photos?.[0]?.getUrl?.({ maxWidth: 320, maxHeight: 180 }) ?? null,
              opening_hours: d.opening_hours ?? null,
            });
          } else res(null);
        });
      });
    const out = [];
    for (const id of placeIds) {
      // eslint-disable-next-line no-await-in-loop
      const r = await runOne(id);
      if (r) out.push(r);
    }
    return out;
  }, [mapObjRef]);

  const runSearch = useCallback((input) => {
    const g = window.google;
    if (!g?.maps) return;
    if (!input.trim()) {
      setCands([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    sessionTokenRef.current = new g.maps.places.AutocompleteSessionToken();
    const ac = new g.maps.places.AutocompleteService();

    const fallbackText = () => {
      const ts = new g.maps.places.TextSearchService();
      ts.textSearch({ query: input, region: 'KR', language: 'ko' }, (list, st) => {
        if (st === g.maps.places.PlacesServiceStatus.OK && Array.isArray(list)) {
          const top = list.slice(0, 8);
          prefetchDetails(top.map((x) => x.place_id)).then((dets) => {
            setCands(dets);
            setOpen(true);
            setLoading(false);
          });
        } else {
          setCands([]);
          setOpen(false);
          setLoading(false);
        }
      });
    };

    ac.getPlacePredictions(
      { input, language: 'ko', region: 'KR', sessionToken: sessionTokenRef.current },
      (preds, st) => {
        if (st === g.maps.places.PlacesServiceStatus.OK && Array.isArray(preds) && preds.length) {
          const top8 = preds.slice(0, 8);
          prefetchDetails(top8.map((p) => p.place_id)).then((dets) => {
            setCands(dets);
            setOpen(true);
            setLoading(false);
          });
        } else {
          fallbackText();
        }
      }
    );
  }, [prefetchDetails]);

  const onChange = (v) => {
    setQ(v);
    if (!v.trim()) {
      setCands([]);
      setOpen(false);
      return;
    }
    setOpen(true);
    clearTimeout(onChange._t);
    onChange._t = setTimeout(() => runSearch(v), 200);
  };

  const onBlur = () => {
    blurTimerRef.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    const onDoc = (e) => {
      const inBox = boxRef.current?.contains(e.target);
      const inPanel = panelRef.current?.contains(e.target);
      if (!inBox && !inPanel) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  return { q, setQ, onChange, onBlur, open, setOpen, loading, cands, boxRef, panelRef };
}

/** 지도 상단 검색 오버레이 (레이아웃 변경 없이 지도 위에만 오버레이) */
function MapSearchOverlay({ mapObjRef, activeDayISO, onAdd }) {
  const { q, setQ, onChange, onBlur, open, setOpen, loading, cands, boxRef, panelRef } = useMapSearch(mapObjRef);

  return (
    <div className="absolute left-4 right-4 top-4 z-[5]">
      <div ref={boxRef} className="bg-white/95 backdrop-blur rounded-xl shadow flex items-center px-3 py-2">
        <svg width="18" height="18" viewBox="0 0 24 24" className="opacity-70 mr-2">
          <path
            fill="currentColor"
            d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79L20 21.49 21.49 20zM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5"
          />
        </svg>
        <input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (q.trim()) setOpen(true);
          }}
          onBlur={onBlur}
          placeholder="장소를 검색하세요 (예: 도고온천, 오코노미야키...)"
          className="flex-1 outline-none bg-transparent text-sm py-1"
        />
        {q && (
          <button
            className="text-xs text-gray-500 hover:text-gray-700"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQ('');
              setOpen(false);
            }}
          >
            지우기
          </button>
        )}
      </div>

      {open && (
        <div ref={panelRef} className="mt-2 max-h-80 overflow-auto rounded-xl shadow-xl border bg-white">
          {loading && <div className="p-3 text-sm text-gray-500">검색 중...</div>}
          {!loading && !cands.length && <div className="p-3 text-sm text-gray-500">검색 결과가 없습니다</div>}

          {!loading &&
            cands.map((c) => (
              <div key={c.placeId} className="px-3 py-3 border-b last:border-b-0 hover:bg-gray-50">
                <div className="flex gap-3">
                  <div className="w-24 h-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-xs text-gray-400">사진 없음</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-sm text-gray-600 truncate">{c.address}</div>
                    <div className="text-xs text-gray-700 mt-1">{hoursSummary(c.opening_hours, activeDayISO)}</div>
                  </div>
                  <div className="flex items-center">
                    <button
                      className="px-3 py-1 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onAdd(c)}
                    >
                      일정에 추가
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function PlanEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  // 메타(기존 UI/UX 유지)
  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [startDate, _setStartDate] = useState('');
  const [endDate, _setEndDate] = useState('');
  const [prefs, setPrefs] = useState('');

  // 날짜 이전값 저장(축소 취소 복구용)
  const prevStartRef = useRef('');
  const prevEndRef = useRef('');

  // Day/일정 (기존 렌더 구조 유지)
  const [days, setDays] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);

  // 지도
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);

  /** 날짜 범위 적용 (축소 시 일정 처리) */
  const applyDateRange = useCallback(
    (newStart, newEnd, opts = { fromInput: null }) => {
      const newDaysBase = makeDays(newStart, newEnd);

      if (!days.length) {
        setDays(newDaysBase);
        setActiveIdx(0);
        return true;
      }

      const toRemove = [];
      const toKeep = [];
      for (const d of days) {
        if (d.date < newStart || d.date > newEnd) toRemove.push(d);
        else toKeep.push(d);
      }

      const hasEntriesInRemoved = toRemove.some((d) => (d.entries?.length || 0) > 0);

      const newMap = new Map(newDaysBase.map((d) => [d.date, { ...d }]));
      for (const d of toKeep) {
        const tgt = newMap.get(d.date);
        if (tgt) {
          tgt.memo = d.memo || '';
          tgt.entries = Array.isArray(d.entries) ? [...d.entries] : [];
          newMap.set(d.date, tgt);
        }
      }

      if (hasEntriesInRemoved) {
        const message =
          `날짜 범위를 줄이면 총 ${toRemove.length}일이 잘려나가며,\n` +
          `${toRemove.filter((d) => (d.entries?.length || 0) > 0).length}일에 일정이 포함되어 있습니다.\n\n` +
          `1) 삭제: 잘려나갈 날짜와 그 안의 일정이 모두 삭제됩니다.\n` +
          `2) 이동: 앞쪽으로 잘리는 일정 → 새 범위의 첫 Day로, 뒤쪽 → 마지막 Day로 이동합니다.\n` +
          `3) 취소: 날짜 변경을 취소합니다.\n\n` +
          `원하는 번호를 입력하세요 (기본 2):`;
        const choice = window.prompt(message, '2');

        if (choice === '3') {
          if (opts.fromInput === 'start') _setStartDate(prevStartRef.current);
          else if (opts.fromInput === 'end') _setEndDate(prevEndRef.current);
          return false;
        }

        if (choice !== '1') {
          const firstDate = newStart;
          const lastDate = newEnd;
          const firstDay = newMap.get(firstDate);
          const lastDay = newMap.get(lastDate);

          for (const d of toRemove) {
            if (!Array.isArray(d.entries) || d.entries.length === 0) continue;
            const target = d.date < newStart ? firstDay : lastDay;
            if (target) target.entries = [...(target.entries || []), ...d.entries];
          }
          if (firstDay) newMap.set(firstDate, firstDay);
          if (lastDay) newMap.set(lastDate, lastDay);
        }
      }

      const finalDays = Array.from(newMap.values());
      setDays(finalDays);

      const keepIdx = Math.max(0, finalDays.findIndex((d) => d.date === toKeep[0]?.date));
      setActiveIdx(keepIdx >= 0 ? keepIdx : 0);
      return true;
    },
    [days]
  );

  const setStartDate = useCallback(
    (v) => {
      prevStartRef.current = startDate;
      _setStartDate(v);
      if (endDate && v && new Date(v) > new Date(endDate)) {
        _setEndDate(v);
        applyDateRange(v, v, { fromInput: 'start' });
      } else if (endDate && v) {
        applyDateRange(v, endDate, { fromInput: 'start' });
      } else if (v && !endDate) {
        setDays([]);
        setActiveIdx(0);
      }
    },
    [startDate, endDate, applyDateRange]
  );

  const setEndDate = useCallback(
    (v) => {
      prevEndRef.current = endDate;
      _setEndDate(v);
      if (startDate && v && new Date(v) < new Date(startDate)) {
        _setStartDate(v);
        applyDateRange(v, v, { fromInput: 'end' });
      } else if (startDate && v) {
        applyDateRange(startDate, v, { fromInput: 'end' });
      } else if (v && !startDate) {
        setDays([]);
        setActiveIdx(0);
      }
    },
    [startDate, endDate, applyDateRange]
  );

  /** 지도 초기화 (기존 레이아웃 유지, 옵션만 보정) */
  useEffect(() => {
    if (!mapRef.current) return;
    const g = window.google;
    if (!g || !g.maps) return;
    const m = new g.maps.Map(mapRef.current, {
      center: { lat: 37.5665, lng: 126.9780 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false, // ✅ 노란사람 비활성화
      fullscreenControl: true,
    });
    mapObjRef.current = m;
  }, []);

  /** 일정 추가/수정/삭제 (UI 변경 없음) */
  const addEntry = useCallback(
    (dayIdx, initial = {}) => {
      const newId = genId();
      setDays((arr) => {
        const cp = [...arr];
        if (!cp[dayIdx]) return arr;
        const d = { ...cp[dayIdx] };
        d.entries = [
          ...(d.entries || []),
          {
            id: newId,
            title: '',
            address: '',
            lat: null,
            lng: null,
            placeId: null,
            opening_hours: null,
            time: '', // 시간 비워두기
            ...initial,
          },
        ];
        cp[dayIdx] = d;
        return cp;
      });
      return newId;
    },
    [setDays]
  );

  const addCandidateToCurrentDay = useCallback(
    (cand) => {
      if (!days?.[activeIdx]) return;
      addEntry(activeIdx, {
        title: cand.name || '',
        address: cand.address || '',
        lat: cand.geometry?.lat ?? null,
        lng: cand.geometry?.lng ?? null,
        placeId: cand.placeId ?? null,
        opening_hours: cand.opening_hours ?? null,
      });
      if (mapObjRef.current && cand.geometry) {
        mapObjRef.current.panTo(cand.geometry);
        mapObjRef.current.setZoom(Math.max(mapObjRef.current.getZoom(), 14));
      }
    },
    [days, activeIdx, addEntry]
  );

  const updateEntryField = useCallback((dayIdx, entryId, patch) => {
    setDays((arr) => {
      const cp = [...arr];
      const d = { ...cp[dayIdx] };
      d.entries = d.entries.map((it) => (it.id === entryId ? { ...it, ...patch } : it));
      cp[dayIdx] = d;
      return cp;
    });
  }, []);

  const removeEntry = useCallback((dayIdx, entryId) => {
    setDays((arr) => {
      const cp = [...arr];
      const d = { ...cp[dayIdx] };
      d.entries = d.entries.filter((it) => it.id !== entryId);
      cp[dayIdx] = d;
      return cp;
    });
  }, []);

  /** Drag & Drop (Day 간 이동 포함) — 기존 UI에 이벤트만 부여 */
  const onDragStartEntry = (dayIdx, entryId, index) => (e) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ fromDayIdx: dayIdx, entryId, fromIndex: index }));
  };
  const onDragOverDay = (dayIdx) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDropOverEntry = (dayIdx, targetIndex) => (e) => {
    e.preventDefault();
    const txt = e.dataTransfer.getData('text/plain');
    if (!txt) return;
    const payload = JSON.parse(txt);
    moveEntry(payload.fromDayIdx, dayIdx, payload.entryId, targetIndex);
  };
  const onDropOnDayEnd = (dayIdx) => (e) => {
    e.preventDefault();
    const txt = e.dataTransfer.getData('text/plain');
    if (!txt) return;
    const payload = JSON.parse(txt);
    moveEntry(payload.fromDayIdx, dayIdx, payload.entryId, null);
  };

  const moveEntry = useCallback((fromDayIdx, toDayIdx, entryId, insertIndex) => {
    setDays((arr) => {
      const cp = [...arr];
      if (!cp[fromDayIdx] || !cp[toDayIdx]) return cp;
      const fromD = { ...cp[fromDayIdx] };
      const moving = fromD.entries.find((e) => e.id === entryId);
      if (!moving) return cp;
      fromD.entries = fromD.entries.filter((e) => e.id !== entryId);
      const toD = { ...cp[toDayIdx] };
      const list = [...toD.entries];
      if (insertIndex == null || insertIndex < 0 || insertIndex > list.length) list.push(moving);
      else list.splice(insertIndex, 0, moving);
      cp[fromDayIdx] = fromD;
      cp[toDayIdx] = toD;
      return cp;
    });
  }, []);

  /** 저장(예시) — 기존 프로젝트 저장 API에 연결해서 사용 */
  const onSave = async () => {
    const payload = { id, title, country, region, startDate, endDate, prefs, days };
    console.log('SAVE', payload);
    alert('임시 저장 로그를 콘솔에 남겼습니다. (프로젝트 저장 API로 교체하세요)');
  };

  const activeDayISO = useMemo(() => days?.[activeIdx]?.date || new Date().toISOString().slice(0, 10), [days, activeIdx]);

  /** ------------------ 렌더 ------------------ */
  return (
    <div className="w-full h-full">
      {/* 좌측 컬럼: 기존 UI/UX 구조/클래스 유지 */}
      <div className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5">
          <div className="space-y-3 bg-white rounded-xl shadow p-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">제목</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="여행 제목" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">나라</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="대한민국" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">지역</label>
                <input value={region} onChange={(e) => setRegion(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="제주, 부산 등" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">시작일</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">종료일</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">취향(선호)</label>
              <input value={prefs} onChange={(e) => setPrefs(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="맛집, 카페, 온천..." />
            </div>

            {/* Day 탭(기존 가로 버튼 UI 유지) */}
            <div>
              <div className="flex flex-wrap gap-2">
                {days.map((d, i) => (
                  <button key={d.id} onClick={() => setActiveIdx(i)} className={`px-3 py-1 rounded-full border ${i === activeIdx ? 'bg-emerald-500 text-white' : 'bg-white'}`}>
                    Day {i + 1} ({d.date})
                  </button>
                ))}
              </div>

              {days[activeIdx] && (
                <div className="mt-3">
                  <label className="block text-sm text-gray-600 mb-1">이 Day 메모</label>
                  <textarea
                    value={days[activeIdx].memo || ''}
                    onChange={(e) =>
                      setDays((arr) => {
                        const cp = [...arr];
                        const d = { ...cp[activeIdx] };
                        d.memo = e.target.value;
                        cp[activeIdx] = d;
                        return cp;
                      })
                    }
                    className="w-full rounded-lg border px-3 py-2 h-24"
                    placeholder="이 날의 메모를 적어두세요"
                  />
                </div>
              )}
            </div>

            <button onClick={onSave} className="mt-2 w-full py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
              저장
            </button>
          </div>

          {/* 일정 리스트(기존 카드 구조 유지, DnD 이벤트만 부여) */}
          {days[activeIdx] && (
            <div className="mt-6 bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Day {activeIdx + 1} 일정</h3>
              </div>

              <div className="space-y-3 min-h-[40px]" onDragOver={onDragOverDay(activeIdx)} onDrop={onDropOnDayEnd(activeIdx)}>
                {days[activeIdx].entries.map((it, idx) => {
                  const outOfHours = it.time && it.opening_hours ? !isTimeWithinOpeningHours(it.opening_hours, days[activeIdx].date, it.time) : false;

                  return (
                    <div
                      key={it.id}
                      className="rounded-lg border p-3 bg-white shadow-sm"
                      draggable
                      onDragStart={onDragStartEntry(activeIdx, it.id, idx)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={onDropOverEntry(activeIdx, idx)}
                    >
                      <div className="flex gap-3">
                        <div className="w-28 h-20 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                          <div className="w-full h-full grid place-items-center text-xs text-gray-400">사진</div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-semibold">{it.title || '(이름 없음)'}</div>
                              <div className="text-sm text-gray-600">{it.address || ''}</div>
                            </div>
                            <button onClick={() => removeEntry(activeIdx, it.id)} className="text-sm text-red-500 hover:underline">
                              삭제
                            </button>
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-3 items-center">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">시간</label>
                              <input
                                type="time"
                                value={it.time || ''}
                                onChange={(e) => updateEntryField(activeIdx, it.id, { time: e.target.value })}
                                className="rounded-md border px-2 py-1 w-36"
                              />
                            </div>
                            <div className="text-sm text-gray-700">
                              {it.opening_hours ? hoursSummary(it.opening_hours, days[activeIdx].date) : '영업시간 정보 없음'}
                            </div>
                          </div>

                          {outOfHours && (
                            <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                              <span className="font-semibold">❗</span> 이 시간은 운영시간이 아니에요!
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 text-center text-xs text-gray-400 border-dashed border rounded-md py-2" onDragOver={onDragOverDay(activeIdx)} onDrop={onDropOnDayEnd(activeIdx)}>
                여기로 드롭하면 맨 뒤에 추가돼요
              </div>
            </div>
          )}
        </div>

        {/* 우측 지도(기존 레이아웃 유지) + 검색 오버레이만 추가 */}
        <div className="col-span-12 lg:col-span-7">
          <div className="relative rounded-2xl overflow-hidden shadow">
            <div ref={mapRef} className="w-full h-[520px] bg-gray-100" / style={{ minHeight: 480 }}>
            {/* 지도 상단 단일 검색창 (오버레이) */}
            <MapSearchOverlay mapObjRef={mapObjRef} activeDayISO={activeDayISO} onAdd={addCandidateToCurrentDay} />
          </div>

          <div className="mt-3 text-xs text-gray-500">ⓘ 검색 패널은 입력 중일 때에만 표시되며, 입력을 지우거나 포커스를 벗어나면 자동으로 닫힙니다.</div>
        </div>
      </div>
    </div>
  );
}



// === PATCH: useMapSearch (독립 훅, UI 변화 없음) ===
function useMapSearch(mapObjRef) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [cands, setCands] = React.useState([]); // {placeId, name, address, photoUrl, geometry, opening_hours}
  const sessionTokenRef = React.useRef(null);
  const panelRef = React.useRef(null);
  const boxRef = React.useRef(null);

  const prefetchDetails = React.useCallback(async (placeIds) => {
    const g = window.google;
    if (!g?.maps) return [];
    const svc = new g.maps.places.PlacesService(mapObjRef.current);
    const fields = ['place_id','name','formatted_address','geometry','photos','opening_hours'];
    const runOne = (pid) => new Promise(res => {
      svc.getDetails({ placeId: pid, fields, language: 'ko', region: 'KR' }, (d, st) => {
        if (st === g.maps.places.PlacesServiceStatus.OK && d) {
          res({
            placeId: d.place_id,
            name: d.name,
            address: d.formatted_address,
            geometry: d.geometry?.location ? { lat: d.geometry.location.lat(), lng: d.geometry.location.lng() } : null,
            photoUrl: d.photos?.[0]?.getUrl?.({ maxWidth: 320, maxHeight: 180 }) ?? null,
            opening_hours: d.opening_hours ?? null,
          });
        } else res(null);
      });
    });
    const out = [];
    for (const id of placeIds) { const r = await runOne(id); if (r) out.push(r); }
    return out;
  }, [mapObjRef]);

  const runSearch = React.useCallback((input) => {
    const g = window.google;
    if (!g?.maps) return;
    if (!input.trim()) { setCands([]); setOpen(false); return; }
    setLoading(true);
    sessionTokenRef.current = new g.maps.places.AutocompleteSessionToken();
    const ac = new g.maps.places.AutocompleteService();

    const fallbackText = () => {
      const ts = new g.maps.places.TextSearchService();
      ts.textSearch({ query: input, region: 'KR', language: 'ko' }, (list, st) => {
        if (st === g.maps.places.PlacesServiceStatus.OK && Array.isArray(list)) {
          const top = list.slice(0, 8);
          prefetchDetails(top.map(x => x.place_id)).then(dets => {
            setCands(dets); setOpen(true); setLoading(false);
          });
        } else { setCands([]); setOpen(false); setLoading(false); }
      });
    };

    ac.getPlacePredictions(
      { input, language: 'ko', region: 'KR', sessionToken: sessionTokenRef.current },
      (preds, st) => {
        if (st === g.maps.places.PlacesServiceStatus.OK && Array.isArray(preds) && preds.length) {
          const top8 = preds.slice(0, 8);
          prefetchDetails(top8.map(p => p.place_id)).then(dets => {
            setCands(dets); setOpen(true); setLoading(false);
          });
        } else {
          fallbackText();
        }
      }
    );
  }, [prefetchDetails]);

  const onChange = (v) => {
    setQ(v);
    if (!v.trim()) { setCands([]); setOpen(false); return; }
    setOpen(true);
    clearTimeout(onChange._t);
    onChange._t = setTimeout(() => runSearch(v), 200);
  };

  React.useEffect(() => {
    const onDoc = (e) => {
      const inBox = boxRef.current?.contains(e.target);
      const inPanel = panelRef.current?.contains(e.target);
      if (!inBox && !inPanel) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  return { q, onChange, onBlur: ()=>{}, open, loading, cands, setOpen, boxRef, panelRef, setQ };
}

// === PATCH: MapSearchOverlay (지도 아래에 바로 추가: 기존 UI 영향 없음) ===
function MapSearchOverlay({ mapObjRef, activeDayISO, onAdd }) {
  const { q, onChange, onBlur, open, loading, cands, setOpen, boxRef, panelRef, setQ } = useMapSearch(mapObjRef);
  return (
    <div className="absolute left-4 right-4 top-4 z-[5]">
      <div ref={boxRef} className="bg-white/95 backdrop-blur rounded-xl shadow flex items-center px-3 py-2">
        <svg width="18" height="18" viewBox="0 0 24 24" className="opacity-70 mr-2">
          <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79L20 21.49 21.49 20zM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5" />
        </svg>
        <input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (q.trim()) setOpen(true); }}
          onBlur={onBlur}
          placeholder="장소를 검색하세요 (예: 도고온천, 오코노미야키...)"
          className="flex-1 outline-none bg-transparent text-sm py-1"
        />
        {q && (
          <button
            className="text-xs text-gray-500 hover:text-gray-700"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setQ(''); setOpen(false); }}
          >
            지우기
          </button>
        )}
      </div>
      {open && (
        <div ref={panelRef} className="mt-2 max-h-80 overflow-auto rounded-xl shadow-xl border bg-white">
          {loading && <div className="p-3 text-sm text-gray-500">검색 중...</div>}
          {!loading && !cands.length && <div className="p-3 text-sm text-gray-500">검색 결과가 없습니다</div>}
          {!loading && cands.map(c => (
            <div key={c.placeId} className="px-3 py-3 border-b last:border-b-0 hover:bg-gray-50">
              <div className="flex gap-3">
                <div className="w-24 h-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                  {c.photoUrl ? (
                    <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-xs text-gray-400">사진 없음</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-sm text-gray-600 truncate">{c.address}</div>
                  <div className="text-xs text-gray-700 mt-1">
                    {hoursSummary(c.opening_hours, activeDayISO)}
                  </div>
                </div>
                <div className="flex items-center">
                  <button
                    className="px-3 py-1 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onAdd(c)}
                  >
                    일정에 추가
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


const addEntry = React.useCallback((dayIdx, initial = {}) => {
  const newId = genId();
  setDays(arr => {
    const cp = [...arr];
    if (!cp[dayIdx]) return arr;
    const d = { ...cp[dayIdx] };
    d.entries = [...(d.entries || []), {
      id: newId,
      title: '',
      address: '',
      lat: null, lng: null,
      placeId: null,
      opening_hours: null,
      time: '',          // ← 시간은 비워둠
      ...initial,
    }];
    cp[dayIdx] = d;
    return cp;
  });
  return newId;
}, [setDays]);

const onAddFromCandidate = React.useCallback((cand) => {
  if (!days?.[activeIdx]) return;
  const id = addEntry(activeIdx, {
    title: cand.name || '',
    address: cand.address || '',
    lat: cand.geometry?.lat ?? null,
    lng: cand.geometry?.lng ?? null,
    placeId: cand.placeId ?? null,
    opening_hours: cand.opening_hours ?? null,
  });
  if (mapObjRef.current && cand.geometry) {
    mapObjRef.current.panTo(cand.geometry);
    mapObjRef.current.setZoom(Math.max(mapObjRef.current.getZoom(), 14));
  }
  return id;
}, [days, activeIdx, addEntry]);

