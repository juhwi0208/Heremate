// src/lib/GoogleMapsLoader.js
import { useMemo } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

/**
 * ✅ 단일(싱글톤) 로더 옵션
 * - 여기 옵션이 한 번 정해지면 앱 전역에서 절대 바뀌지 않게 유지해야
 *   "Loader must not be called again with different options" 에러가 안 납니다.
 * - language: 'ko', region: 'KR' 로 한국 사용자 기본값 고정
 */
// 🔁 교체: 키 읽기 (Vite + CRA 모두 지원) + 빈 키면 로더 호출 중단
const GOOGLE_MAPS_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY ||
  '';

console.log('[DEBUG] GMAPS KEY]', GOOGLE_MAPS_API_KEY ? GOOGLE_MAPS_API_KEY.slice(0,6)+'…' : '(empty)');

const LIBRARIES = ['places', 'marker'];

// 절대 바뀌지 않는 싱글톤 옵션 (옵션이 바뀌면 라이브러리가 에러를 냄)
export const GOOGLE_LOADER_OPTIONS = Object.freeze({
  id: 'script-loader',
  version: 'weekly',
  googleMapsApiKey: GOOGLE_MAPS_API_KEY, // ← react-google-maps/api v2 권장 키 명
  libraries: LIBRARIES,
  language: 'ko',
  region: 'KR',
  mapIds: [],
  nonce: '',
  url: 'https://maps.googleapis.com/maps/api/js',
  authReferrerPolicy: 'origin',
});

/**
 * 앱 전역에서 사용할 로더 훅
 * - 어디서든 이 훅만 쓰면 로더 중복/옵션불일치가 발생하지 않습니다.
 */
export function useGoogleMapsLoader() {
  // options 객체는 절대 새로 만들지 않도록 고정
  const options = GOOGLE_LOADER_OPTIONS;

  // useMemo로 안전하게 유지(실제로는 고정 객체라 재생성 안됨)
  const stableOpts = useMemo(() => options, [options]);

  const result = useJsApiLoader(stableOpts);

  if (!GOOGLE_MAPS_API_KEY && typeof window !== 'undefined') {
    // 키가 비어 있을 경우 콘솔 경고만(UX 영향 최소화)
    // eslint-disable-next-line no-console
    console.warn('[googleMapsLoader] Missing GOOGLE MAPS API KEY. Set REACT_APP_GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY.');
  }

  return result; // { isLoaded, loadError }
}