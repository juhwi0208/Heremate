import { useEffect, useMemo, useRef, useState } from 'react';
import axios from '../api/axiosInstance';

// 세션 토큰 생성(간단 UUID v4 대체)
function makeToken() {
  return 'xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8); // 우선순위 명확화(기능 동일)
    return v.toString(16);
  });
}

// 간단 메모리 캐시: key -> {ts, items}
const cache = new Map();
// 캐시 키 조합
const keyOf = (q, lat, lng, radius) => `${q}__${lat?.toFixed(3)}_${lng?.toFixed(3)}_${radius}`;

export default function UsePlacesAutocomplete({
  query,
  lat,
  lng,
  radius = 50000,
  language = 'ko',
  region = 'KR',
  minLength = 2,
  debounceMs = 400
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // 입력이 변할 때마다 “같은 세션” 안에서는 동일 토큰 유지
  const sessionRef = useRef(makeToken());
  const lastQRef = useRef('');
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  // 지역 좌표가 없으면 호출 금지
  const enabled = (query?.trim().length >= minLength) && Number.isFinite(lat) && Number.isFinite(lng);

  // 안정화된 파라미터
  const p = useMemo(() => ({
    q: query.trim(),
    lat: Number(lat), lng: Number(lng), radius, language, region
  }), [query, lat, lng, radius, language, region]);

  useEffect(() => {
    // 쿼리 짧거나 지역정보 없으면 클리어
    if (!enabled) {
      setItems([]);
      return;
    }

    // 동일 입력이면 재호출 금지
    const nowKey = keyOf(p.q, p.lat, p.lng, p.radius);
    if (lastQRef.current === nowKey) return;

    // 캐시 적중?
    const cached = cache.get(nowKey);
    if (cached && (Date.now() - cached.ts < 5 * 60 * 1000)) { // 5분
      lastQRef.current = nowKey;
      setItems(cached.items);
      return;
    }

    // 디바운스
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      // 진행중 요청 취소
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setErr(null);

      try {
        const res = await axios.get('/api/places/autocomplete', {
          signal: controller.signal,
          params: {
            q: p.q,
            lat: p.lat,
            lng: p.lng,
            radius: p.radius,
            lang: p.language,
            region: p.region,
            sessionToken: sessionRef.current,
          }
        });
        const predictions = res.data?.predictions || [];
        setItems(predictions);
        cache.set(nowKey, { ts: Date.now(), items: predictions });
        lastQRef.current = nowKey;
      } catch (e) {
        if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return;
        setErr(e);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [enabled, p, debounceMs]);

  // 세션 리셋(사용자가 입력창을 포커스 잃었다가 다시 시작하면 새 세션으로)
  const resetSession = () => {
    sessionRef.current = makeToken();
  };

  return { items, loading, error: err, resetSession, sessionToken: sessionRef.current };
}
