// client/src/lib/GoogleMapsLoader.js
import { useMemo } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

// 전역에 최초 옵션을 저장해서, 이후 호출에서 *반드시* 같은 옵션을 쓰도록 한다.
const GMAPS_GLOBAL = '__heremate_gmaps_loader_options__';

function getStableOptions() {
  const w = window;
  const apiKey =
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.REACT_APP_GCP_API_KEY ||
    '';

  // 기본은 ko/KR로 고정 (다국어가 꼭 필요하면 .env 로만 바꾸세요)
  const base = {
    id: 'heremate-script-loader',
    version: 'weekly',
    googleMapsApiKey: apiKey,
    libraries: ['places', 'marker'],
    language:
      process.env.REACT_APP_GMAPS_LANG ||
      process.env.VITE_GMAPS_LANG ||
      'ko',
    region:
      process.env.REACT_APP_GMAPS_REGION ||
      process.env.VITE_GMAPS_REGION ||
      'KR',
  };

  // 이미 이전 호출이 있었다면, 같은 옵션을 재사용
  if (w[GMAPS_GLOBAL]) return w[GMAPS_GLOBAL];
  w[GMAPS_GLOBAL] = base;
  return base;
}

export default function useGoogleMapsLoader() {
  const stable = useMemo(() => getStableOptions(), []);
  const { isLoaded, loadError } = useJsApiLoader(stable);

  if (process.env.NODE_ENV !== 'production') {
    // 디버그 찍기
    if (loadError) {
      // eslint-disable-next-line no-console
      console.error('[googleMapsLoader] loadError:', loadError);
    } else {
      // eslint-disable-next-line no-console
      console.debug(
        '[googleMapsLoader] Options:',
        JSON.stringify(
          { id: stable.id, lang: stable.language, region: stable.region, libs: stable.libraries },
          null,
          2
        )
      );
    }
  }

  return { isLoaded, loadError };
}
