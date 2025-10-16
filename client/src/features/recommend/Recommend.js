// client/src/features/recommend/Recommend.js
// 2/3 지도 + 1/3 검색/후보 패널 레이아웃
// "이름이 주소로 뜨는 문제" 해결(항상 name/displayName/main_text를 제목으로 사용)

import React, { useEffect, useRef, useState } from 'react';
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

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_LIBRARIES,
    version: 'weekly',
  });

  // Google 객체/서비스 핸들러
  const mapRef = useRef(null);
  const placesSvcRef = useRef(null);
  const geocoderRef = useRef(null);
  const autocompleteRef = useRef(null);
  const sessionTokenRef = useRef(null);

  // 검색/후보/상세 캐시
  const [mapSearch, setMapSearch] = useState('');
  const [mapPreds, setMapPreds] = useState([]); // {place_id, main_text, secondary_text}
  const [detailCache, setDetailCache] = useState({}); // { [place_id]: { title, address, openingHours, photoUrl } }

  // 지도 임시 핀
  const [tempPin, setTempPin] = useState(null);

  // Map 초기화
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

  // 후보 상세(주소/영업/사진/제목) 미리 캐시
  useEffect(() => {
    const svc = placesSvcRef.current;
    const Place = window.google?.maps?.places?.Place;
    const nextIds = new Set(mapPreds.map((p) => p.place_id).filter(Boolean));

    nextIds.forEach((pid) => {
      if (!pid || detailCache[pid]) return;

      (async () => {
        // 1) 신형 Place.fetchFields()
        if (Place) {
          try {
            const place = new Place({ id: pid, requestedLanguage: 'ko', requestedRegion: 'KR' });
            const det = await place.fetchFields({
              fields: ['displayName','name','formattedAddress','regularOpeningHours','photos'],
            });
            if (det) {
              const p = det.photos?.[0];
              let photoUrl = '';
              try { photoUrl = p?.getURL ? p.getURL({ maxWidth: 400, maxHeight: 300 }) : ''; } catch {}
              setDetailCache((prev) => ({
                ...prev,
                [pid]: {
                  title: det.displayName?.text || det.name || '',
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
            { placeId: pid, fields: ['name','formatted_address','opening_hours','photos'] },
            (det, st) => {
              if (st !== window.google.maps.places.PlacesServiceStatus.OK || !det) return;
              const p = det.photos?.[0];
              let photoUrl = '';
              try { photoUrl = p?.getUrl ? p.getUrl({ maxWidth: 400, maxHeight: 300 }) : ''; } catch {}
              setDetailCache((prev) => ({
                ...prev,
                [pid]: {
                  title: det.name || '',
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
                title: det?.displayName?.text || det?.name || '',
                address: det?.formattedAddress || '',
                openingHours: normalizeOpeningHours(det?.regularOpeningHours || null),
                photoUrl: '',
              },
            }));
          }
        } catch {/* no-op */}
      })();
    });
  }, [mapPreds]);

  // 자동완성/텍스트/지오코더/HTTP 폴백으로 후보 가져오기 (이름 우선 정규화)
  const fetchMapPreds = (q) => {
    setMapSearch(q);
    if (!q) { setMapPreds([]); return; }

    const ac  = autocompleteRef.current;
    const svc = placesSvcRef.current;
    const gc  = geocoderRef.current;
    const token = sessionTokenRef.current;

    const show = (list) => setMapPreds((list || []).slice(0, 20));

    // 1) Autocomplete (이름 우선: establishment 중심)
    const doAutocomplete = () => new Promise((resolve) => {
      if (!ac) return resolve(false);
      ac.getPlacePredictions(
        {
          input: q,
          language: 'ko',
          region: 'KR',
          sessionToken: token,
          types: ['establishment'], // 주소(geocode) 남발 방지. 필요시 'tourist_attraction' 추가.
        },
        (list, status) => {
          if (status === 'OK' && Array.isArray(list) && list.length) {
            const normalized = list.map((p) => ({
              source: 'ac',
              place_id: p.place_id,
              main_text: p.structured_formatting?.main_text || '',
              secondary_text: p.structured_formatting?.secondary_text || '',
            }));
            show(normalized);
            return resolve(true);
          }
          resolve(false);
        }
      );
    });

    // 2) 서버(Places API New) 폴백
    const doServerSearch = async () => {
      try {
        const resp = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
        if (!resp.ok) return false;
        const json = await resp.json();
        const preds = (json?.places || []).map((r) => ({
          source: 'server',
          place_id: r.id || r.place_id || null,
          main_text: r.displayName?.text || r.name || '',
          secondary_text: r.formattedAddress || r.vicinity || '',
        }));
        if (preds.length) { show(preds); return true; }
        return false;
      } catch { return false; }
    };

    // 3) TextSearch (이름 → 주소 보조)
    const doTextSearch = () => new Promise((resolve) => {
      if (!svc?.textSearch) return resolve(false);
      svc.textSearch({ query: q, language: 'ko', region: 'KR' }, (res, st) => {
        if (st === 'OK' && Array.isArray(res) && res.length) {
          const preds = res.map((r) => ({
            source: 'ts',
            place_id: r.place_id || r.id || null,
            main_text: r.name || r.displayName?.text || '',
            secondary_text: r.formatted_address || r.vicinity || r.formattedAddress || '',
          }));
          show(preds);
          return resolve(true);
        }
        resolve(false);
      });
    });

    // 4) Geocoder (마지막 수단 — 주소 라벨)
    const doGeocode = () => new Promise((resolve) => {
      if (!gc) return resolve(false);
      gc.geocode({ address: q, language: 'ko', region: 'KR' }, (res, st) => {
        if (st === 'OK' && Array.isArray(res) && res.length) {
          const preds = res.map((r) => ({
            source: 'gc',
            place_id: r.place_id || null,
            main_text: r.address_components?.[0]?.long_name || '주소',
            secondary_text: r.formatted_address || '',
          }));
          show(preds);
          return resolve(true);
        }
        resolve(false);
      });
    });

    (async () => {
      if (await doAutocomplete()) return;
      if (await doServerSearch()) return;
      if (await doTextSearch())  return;
      if (await doGeocode())     return;
      setMapPreds([]);
    })();
  };

  // 후보 클릭 → 지도 중심 이동 + 핀
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

    const q = pred?.main_text;
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
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
      <h2 className="text-xl md:text-2xl font-bold text-green-700 mb-4">관광지 검색</h2>

      {/* 2/3 : 1/3 레이아웃 (모바일 1열, md 이상 2열) */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4 md:gap-6">
        {/* 왼쪽: 지도 (2/3) */}
        <div className="rounded-xl overflow-hidden border min-h-[65vh]">
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
            >
              {tempPin && <Marker position={{ lat: tempPin.lat, lng: tempPin.lng }} />}
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">구글맵 로드 중…</div>
          )}
        </div>

        {/* 오른쪽: 검색/후보 (1/3) - sticky + 스크롤 */}
        <aside className="md:sticky md:top-4 h-auto md:max-h-[65vh] md:overflow-auto">
          {/* 검색 인풋 */}
          <div className="mb-3">
            <label className="text-xs text-zinc-600 mb-1 block">지도에서 장소 찾기</label>
            <input
              value={mapSearch}
              onChange={(e) => fetchMapPreds(e.target.value)}
              placeholder="장소명을 입력하세요 (예: 도고온천, 디즈니랜드)"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <p className="mt-2 text-[11px] text-zinc-500">
              아래 후보를 클릭하면 왼쪽 지도에서 위치를 바로 확인할 수 있어요.
            </p>
          </div>

          {/* 후보 리스트 */}
          <div className="space-y-2">
            {mapPreds.length === 0 && (
              <div className="text-sm text-zinc-500 border rounded-lg p-3">검색어를 입력해보세요.</div>
            )}

            {mapPreds.map((p) => {
              const det = detailCache[p.place_id] || {};
              const placeName = det.title || p.main_text || '이름 없음';
              const placeAddress = det.address || p.secondary_text || '';

              return (
                <button
                  key={p.place_id || placeName}
                  onClick={() => panToPred(p)}
                  className="w-full text-left border rounded-xl bg-white p-3 hover:bg-zinc-50 transition"
                >
                  <div className="flex gap-3">
                    {det.photoUrl ? (
                      <img src={det.photoUrl} alt="thumb" className="w-14 h-14 rounded object-cover flex-none" />
                    ) : (
                      <div className="w-14 h-14 rounded bg-zinc-100 grid place-items-center text-[10px] text-zinc-400 flex-none">
                        NO IMG
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{placeName}</div>
                      <div className="text-xs text-zinc-500 truncate">{placeAddress}</div>
                      {det.openingHours && (
                        <div className="text-[11px] text-zinc-400 mt-1">
                          {summarizeTodayHours(det.openingHours)}
                        </div>
                      )}
                      <div className="mt-2">
                        <span className="inline-block text-[11px] px-2 py-1 rounded border">
                          지도에서 보기
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
