// client/src/features/recommend/Recommend.js
// 🔎 PlanEditor의 지도 검색/후보 카드/지도보기만 경량 복사한 컴포넌트
import React, { useEffect, useMemo, useRef, useState, detailCache } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

const GOOGLE_LIBRARIES = ['places'];

function normalizeOpeningHours(src) {
  if (!src) return null;
  try {
    const base = src.regularOpeningHours || src;
    const toHHMM = (x) => {
      if (!x) return '0000';
      if (typeof x.time === 'string') return x.time;
      const h = String(x.hour ?? 0).padStart(2, '0');
      const m = String(x.minute ?? 0).padStart(2, '0');
      return `${h}${m}`;
    };
    const periods = (base?.periods || []).map((p) => ({
      open:  p.open  ? { day: p.open.day,  time: toHHMM(p.open)  } : undefined,
      close: p.close ? { day: p.close.day, time: toHHMM(p.close) } : undefined,
    }));
    return periods.length ? { periods } : null;
  } catch {
    return null;
  }
}

function summarizeTodayHours(openingHours) {
  try {
    if (!openingHours?.periods?.length) return null;
    const wd = new Date().getDay(); // 0=Sun
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
    return today.length ? `오늘 영업: ${today.join(', ')}` : null;
  } catch {
    return null;
  }
}

export default function Recommend() {
  // 기본 서울 중심
  const [mapCenter, setMapCenter] = useState({ lat: 37.5665, lng: 126.9780 });
  const [mapZoom, setMapZoom] = useState(12);

  // 구글맵 로더
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_LIBRARIES,
    version: 'weekly',
  });

  // 구글 객체/서비스 핸들러
  const mapRef = useRef(null);
  const placesSvcRef = useRef(null);
  const geocoderRef = useRef(null);
  const autocompleteRef = useRef(null);
  const sessionTokenRef = useRef(null);

  // 검색 입력/결과/상태
  const [mapSearch, setMapSearch] = useState('');
  const [mapPreds, setMapPreds] = useState([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [detailCache, setDetailCache] = useState({}); // { [place_id]: { address, openingHours, photoUrl } }

  // 지도 임시 핀(후보 지도보기용)
  const [tempPin, setTempPin] = useState(null);

  // Google 객체 준비
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

  // 후보 리스트가 바뀌면 미리 상세(주소/사진/영업시간)를 캐시
  useEffect(() => {
    const svc = placesSvcRef.current;
    const Place = window.google?.maps?.places?.Place;
    const nextIds = new Set(mapPreds.map((p) => p.place_id).filter(Boolean));
    nextIds.forEach((pid) => {
      if (detailCache[pid]) return;
      (async () => {
        // 1) 신형 Place.fetchFields()
        if (Place) {
          try {
            const place = new Place({ id: pid, requestedLanguage: 'ko', requestedRegion: 'KR' });
            const det = await place.fetchFields({ fields: ['formattedAddress','regularOpeningHours','photos'] });
            if (det) {
              const p = det.photos?.[0];
              let photoUrl = '';
              try { photoUrl = p?.getURL ? p.getURL({ maxWidth: 400, maxHeight: 300 }) : ''; } catch {}
              setDetailCache((prev) => ({
                ...prev,
                [pid]: {
                  address: det.formattedAddress || '',
                  openingHours: normalizeOpeningHours(det.regularOpeningHours || null),
                  photoUrl,
                },
              }));
              return;
            }
          } catch {/* no-op */}
        }
        // 2) 구형 getDetails 폴백
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
        // 3) 서버(Places API New HTTP) 폴백
        try {
          const resp = await fetch(`/api/places/details?id=${encodeURIComponent(pid)}`);
          if (resp.ok) {
            const det = await resp.json();
            setDetailCache((prev) => ({
              ...prev,
              [pid]: {
                address: det?.formattedAddress || '',
                openingHours: normalizeOpeningHours(det?.regularOpeningHours || null),
                photoUrl: (() => {
                  const ph = det?.photos?.[0];
                  return ph?.name ? '' : ''; // HTTP 응답에는 직접 URL이 없을 수 있음(여기선 생략)
                })(),
              },
            }));
          }
        } catch {/* no-op */}
      })();
    });
  
  }, [mapPreds]);

  // 자동완성/텍스트/지오코더/HTTP 폴백으로 후보 가져오기
  const fetchMapPreds = (q) => {
    setMapSearch(q);
    if (!q) { setMapPreds([]); setResultsOpen(false); return; }

    const ac  = autocompleteRef.current;
    const svc = placesSvcRef.current;
    const gc  = geocoderRef.current;
    const token = sessionTokenRef.current;

    const toPredCards = (arr) =>
      (arr || []).map((r) => ({
        place_id: r.place_id || r.id || null,
        description: r.name || r.formatted_address || r.formattedAddress || '',
        structured_formatting: {
          main_text: r.displayName?.text || r.name || r.structured_formatting?.main_text || '',
          secondary_text: r.formattedAddress || r.formatted_address || r.vicinity || r.structured_formatting?.secondary_text || '',
        },
      }));

    const show = (list) => {
      const sliced = (list || []).slice(0, 8);
      setMapPreds(sliced);
      setResultsOpen(((q || '').trim().length > 0) && sliced.length > 0);
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
      // 서버(Places API New) 폴백
      const doServerSearch = async () => {
        try {
          const resp = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
          if (!resp.ok) return false;
          const json = await resp.json();
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
        } catch { return false; }
      };
      if (await doServerSearch()) return;
      if (await doTextSearch())  return;
      if (await doGeocode())     return;
      setMapPreds([]); setResultsOpen(false);
    })();
  };

  // 후보 → 지도 중심 이동(핀 표시)
  const panToPred = async (pred) => {
    const Place = window.google?.maps?.places?.Place;
    const pid = pred?.place_id;
    const pickLatLng = (loc) => {
      if (!loc) return null;
      if (typeof loc.lat === 'function' && typeof loc.lng === 'function') return { lat: +loc.lat(), lng: +loc.lng() };
      if (loc.latLng && typeof loc.latLng.lat === 'function') return { lat: +loc.latLng.lat(), lng: +loc.latLng.lng() };
      if (typeof loc.lat === 'number' && typeof loc.lng === 'number') return { lat: +loc.lat, lng: +loc.lng };
      return null;
    };

    if (Place && pid) {
      try {
        const det = await new Place({ id: pid, requestedLanguage: 'ko', requestedRegion: 'KR' })
          .fetchFields({ fields: ['location'] });
        const pt = pickLatLng(det?.location);
        if (pt) {
          setMapCenter(pt); setMapZoom(15);
          mapRef.current?.panTo(pt);
          setTempPin(pt);
          return;
        }
      } catch {/* no-op */}
    }

    if (pid) {
      try {
        const r = await fetch(`/api/places/details?id=${encodeURIComponent(pid)}`);
        if (r.ok) {
          const det = await r.json();
          const pt = det?.location ? { lat: +det.location.latitude, lng: +det.location.longitude } : null;
          if (pt) {
            setMapCenter(pt); setMapZoom(15);
            mapRef.current?.panTo(pt);
            setTempPin(pt);
            return;
          }
        }
      } catch {/* no-op */}
    }

    const q = pred?.structured_formatting?.main_text || pred?.description;
    geocoderRef.current?.geocode({ address: q, language: 'ko', region: 'KR' }, (res, st) => {
      if (st === 'OK' && res?.[0]) {
        const loc = res[0].geometry?.location;
        if (loc) {
          const pt = { lat: loc.lat(), lng: loc.lng() };
          setMapCenter(pt); setMapZoom(15);
          mapRef.current?.panTo(pt);
          setTempPin(pt);
        }
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-green-700">관광지 검색</h2>
      </div>

      {/* 검색 인풋 */}
      <div className="mb-3">
        <div className="text-xs mb-1">지도에서 장소 찾기</div>
        <input
          value={mapSearch}
          onChange={(e) => fetchMapPreds(e.target.value)}
          onFocus={() => setResultsOpen(Boolean((mapSearch || '').trim()))}
          placeholder="장소명을 입력하세요 (예: 도고온천, 디즈니랜드)"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <div className="relative my-2">
          <div className="inline-block bg-zinc-200 text-zinc-700 text-xs px-3 py-2 rounded-2xl shadow-sm">
            검색하면 아래 카드로 후보가 떠요. ‘지도보기’를 누르면 위치를 바로 확인할 수 있어요.
          </div>
          <div className="absolute -bottom-2 left-4 w-0 h-0 border-l-6 border-r-6 border-t-6 border-l-transparent border-r-transparent border-t-zinc-200" />
        </div>
      </div>

      {/* 지도 */}
      <div className="rounded-xl overflow-hidden border h-[360px]">
        {isLoaded ? (
          <GoogleMap
            onLoad={onMapLoad}
            onUnmount={onMapUnmount}
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
            onClick={() => setResultsOpen(false)}
          >
            {tempPin && <Marker position={{ lat: tempPin.lat, lng: tempPin.lng }} />}
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">구글맵 로드 중…</div>
        )}
      </div>

      {/* 후보 카드 리스트 */}
      {resultsOpen && mapPreds.length > 0 && (
        <div className="mt-3 space-y-2">
          {mapPreds.map((p) => {
            const det = detailCache[p.place_id] || {};
            const placeName = p.structured_formatting?.main_text || p.description;
            const placeAddress = det.address || p.structured_formatting?.secondary_text;

            return (
              <div key={p.place_id || placeName} className="border rounded-xl bg-white p-3">
                <div className="flex gap-3">
                  {det.photoUrl ? (
                    <img src={det.photoUrl} alt="thumb" className="w-16 h-16 rounded object-cover flex-none" />
                  ) : (
                    <div className="w-16 h-16 rounded bg-zinc-100 grid place-items-center text-[11px] text-zinc-400 flex-none">
                      NO IMG
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{placeName}</div>
                    <div className="text-xs text-zinc-500 truncate">{placeAddress}</div>
                    {det.openingHours && (
                      <div className="text-[11px] text-zinc-400 mt-1">{summarizeTodayHours(det.openingHours)}</div>
                    )}

                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => panToPred(p)}
                        className="px-3 py-1.5 text-xs rounded-lg border"
                      >
                        지도보기
                      </button>
                      {/* 필요 시 다음 버튼 추가: “상세 열기”, “Google 지도 열기” 등 */}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
