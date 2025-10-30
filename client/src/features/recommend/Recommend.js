// client/src/features/recommend/Recommend.js
// Recommend 후보 썸네일 안정화 (기능/UI 동일 유지)
//  - v1 전용 후보: 서버 디테일 → (사진 없으면) JS TextSearch로 place_id 역추적
//  - 렌더링 캐시 키 우선순위: id_v1 → place_id
//  - 사진 추출: getURI → getUrl → getURL 순

import React, { useEffect, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

const GOOGLE_LIBRARIES = ['places', 'marker'];

function normalizeOpeningHours(src) {
  if (!src) return null;
  try {
    const base = src.regularOpeningHours || src;
    const toHHMM = (x) => {
      if (!x) return '0000';
      if (typeof x.time === 'string') return x.time; // 'HHMM'
      const h = String(x.hour ?? 0).padStart(2, '0');
      const m = String(x.minute ?? 0).padStart(2, '0');
      return `${h}${m}`;
    };
    const periods = (base?.periods || []).map((p) => ({
      open:  p.open  ? { day: p.open.day,  time: toHHMM(p.open)  } : undefined,
      close: p.close ? { day: p.close.day, time: toHHMM(p.close) } : undefined,
    }));
    return periods.length ? { periods } : null;
  } catch { return null; }
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
        const fmt = (t) => `${t.slice(0,2)}:${t.slice(2)}`;
        const ot = p.open?.time || '0000';
        const ct = p.close?.time || '2400';
        return `${fmt(ot)}–${fmt(ct)}`;
      });
    return today.length ? `오늘 영업: ${today.join(', ')}` : null;
  } catch { return null; }
}

export default function Recommend() {
  const [mapCenter, setMapCenter] = useState({ lat: 37.5665, lng: 126.9780 });
  const [mapZoom, setMapZoom] = useState(12);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_LIBRARIES,
    version: 'weekly',
    // language/region은 각 호출에서 'ko'/'KR'로 지정
  });

  const mapRef = useRef(null);
  const placesSvcRef = useRef(null);
  const geocoderRef  = useRef(null);
  const autocompleteRef = useRef(null);
  const sessionTokenRef = useRef(null);

  // 검색 상태/캐시
  const [mapSearch, setMapSearch] = useState('');
  const [mapPreds, setMapPreds]   = useState([]); // [{ place_id?, id_v1?, main_text, secondary_text }]
  const [detailCache, setDetailCache] = useState({}); // { [id]: {title,address,openingHours,photoUrl} }
  const [tempPin, setTempPin] = useState(null);

  const onMapLoad = (m) => {
    mapRef.current = m;
    if (window.google?.maps) {
      const anchor = m || document.createElement('div');
      if (!placesSvcRef.current) placesSvcRef.current = new window.google.maps.places.PlacesService(anchor);
      if (!geocoderRef.current)  geocoderRef.current  = new window.google.maps.Geocoder();
      if (!autocompleteRef.current) autocompleteRef.current = new window.google.maps.places.AutocompleteService();
      if (!sessionTokenRef.current) sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  };

  // 후보 바뀌면 상세(특히 사진) 채우기
  useEffect(() => {
    const svc   = placesSvcRef.current;
    const Place = window.google?.maps?.places?.Place;

    const byPid = mapPreds.filter((p) => p.place_id);
    const byV1  = mapPreds.filter((p) => p.id_v1 && !p.place_id); // v1만 가진 후보

    // 1) place_id 보유 후보: JS SDK → (실패 시) 서버 폴백
    byPid.forEach((item) => {
      const pid = item.place_id;
      if (!pid || detailCache[pid]) return;

      (async () => {
        // 1-A) 신형 Place.fetchFields()
        if (Place) {
          try {
            const place = new Place({ id: pid, requestedLanguage: 'ko', requestedRegion: 'KR' });
            const det   = await place.fetchFields({ fields: ['displayName','name','formattedAddress','regularOpeningHours','photos'] });
            if (det) {
              const ph = place.photos?.[0];
              let url = '';
              try {
                if (ph?.getURI)      url = ph.getURI({ maxWidth: 400, maxHeight: 300 });
                else if (ph?.getUrl) url = ph.getUrl({ maxWidth: 400, maxHeight: 300 });
                else if (ph?.getURL) url = ph.getURL({ maxWidth: 400, maxHeight: 300 });
              } catch {}
              setDetailCache((prev) => ({
                ...prev,
                [pid]: {
                  title: det?.displayName?.text || det?.name || item.main_text || '',
                  address: det?.formattedAddress || item.secondary_text || '',
                  openingHours: normalizeOpeningHours(det?.regularOpeningHours || null),
                  photoUrl: url || '',
                },
              }));
              if (url) return; // 사진 얻었으면 끝
            }
          } catch {}
        }

        // 1-B) 서버 폴백
        try {
          const resp = await fetch(`/api/places/details?id=${encodeURIComponent(pid)}`);
          if (resp.ok) {
            const det = await resp.json();
            let photoUrl = det?.photoUrl || '';
            // 서버 안전망: photos[0].name → v1 미디어 URL 직접 생성(프론트 키 사용)
            if (!photoUrl && Array.isArray(det?.photos) && det.photos[0]?.name) {
              const name = det.photos[0].name; // "places/.../photos/..."
              const qs = new URLSearchParams({
                maxWidth: '400',
                maxHeight: '300',
                key: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
              });
              photoUrl = `https://places.googleapis.com/v1/${encodeURIComponent(name)}/media?${qs.toString()}`;
            }
            setDetailCache((prev) => ({
              ...prev,
              [pid]: {
                title: det?.displayName?.text || det?.name || item.main_text || '',
                address: det?.formattedAddress || item.secondary_text || '',
                openingHours: normalizeOpeningHours(det?.regularOpeningHours || null),
                photoUrl: photoUrl || '',
              },
            }));
          }
        } catch {}
      })();
    });

    // 2) v1 전용 후보: 서버 디테일 → (사진 없으면) JS TextSearch로 place_id 역추적
    byV1.forEach((item) => {
      const v1id = item.id_v1;
      if (!v1id || detailCache[v1id]) return;

      (async () => {
        // 2-A) 서버 디테일 먼저
        try {
          const resp = await fetch(`/api/places/details?id=${encodeURIComponent(v1id)}`);
          if (resp.ok) {
            const det = await resp.json();
            const photoUrl = det?.photoUrl || '';
            setDetailCache(prev => ({
              ...prev,
              [v1id]: {
                title: det?.displayName?.text || det?.name || item.main_text || '',
                address: det?.formattedAddress || item.secondary_text || '',
                openingHours: normalizeOpeningHours(det?.regularOpeningHours || null),
                photoUrl,
              },
            }));
            if (photoUrl) return; // 서버가 사진까지 주면 종료
          }
        } catch {}

        // 2-B) 서버가 사진 못 줄 때: JS TextSearch → JS Place 사진
        const svc = placesSvcRef.current;
        if (!svc || !Place) return;
        const query = [item.main_text, item.secondary_text].filter(Boolean).join(' ');
        svc.textSearch({ query, language: 'ko', region: 'KR' }, async (res, st) => {
          if (st !== 'OK' || !Array.isArray(res) || !res.length) return;
          const pid = res[0].place_id;
          if (!pid) return;
          try {
            const place = new Place({ id: pid, requestedLanguage: 'ko', requestedRegion: 'KR' });
            await place.fetchFields({ fields: ['displayName','name','formattedAddress','regularOpeningHours','photos'] });
            const ph = place.photos?.[0];
            let url = '';
            try {
              if (ph?.getURI)      url = ph.getURI({ maxWidth: 400, maxHeight: 300 });
              else if (ph?.getUrl) url = ph.getUrl({ maxWidth: 400, maxHeight: 300 });
              else if (ph?.getURL) url = ph.getURL({ maxWidth: 400, maxHeight: 300 });
            } catch {}
            setDetailCache(prev => ({
              ...prev,
              [v1id]: {
                title: place.displayName?.text || place.name || item.main_text || '',
                address: place.formattedAddress || item.secondary_text || '',
                openingHours: normalizeOpeningHours(place.regularOpeningHours || null),
                photoUrl: url || '',
              },
            }));
          } catch {}
        });
      })();
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapPreds]);

  // 후보 검색(AC → 서버 v1 → TextSearch → Geocode 순)
  const fetchMapPreds = (q) => {
    setMapSearch(q);
    if (!q) { setMapPreds([]); return; }

    const ac  = autocompleteRef.current;
    const svc = placesSvcRef.current;
    const gc  = geocoderRef.current;
    const token = sessionTokenRef.current;

    const show = (list) => setMapPreds((list || []).slice(0, 20));

    // 1) Autocomplete
    const doAutocomplete = () => new Promise((resolve) => {
      if (!ac) return resolve(false);
      ac.getPlacePredictions({ input: q, language: 'ko', region: 'KR', sessionToken: token }, (list, status) => {
        if (status === 'OK' && Array.isArray(list) && list.length) {
          const normalized = list.map((p) => ({
            source: 'ac',
            place_id: p.place_id,
            id_v1: null,
            main_text: p.structured_formatting?.main_text || '',
            secondary_text: p.structured_formatting?.secondary_text || '',
          }));
          show(normalized);
          return resolve(true);
        }
        resolve(false);
      });
    });

    // 2) 서버 v1 Search (id_v1를 받음)
    const doServerSearch = async () => {
      try {
        const resp = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
        if (!resp.ok) return false;
        const json = await resp.json();
        const preds = (json?.places || []).map((r) => ({
          source: 'server',
          place_id: r.placeId || r.place_id || null, // 있으면 사용
          id_v1: r.id || null,                       // "places/XXXX"
          main_text: r.displayName?.text || r.name || '',
          secondary_text: r.formattedAddress || r.vicinity || '',
        }));
        if (preds.length) { show(preds); return true; }
        return false;
      } catch { return false; }
    };

    // 3) JS TextSearch
    const doTextSearch = () => new Promise((resolve) => {
      if (!svc?.textSearch) return resolve(false);
      svc.textSearch({ query: q, language: 'ko', region: 'KR' }, (res, st) => {
        if (st === 'OK' && Array.isArray(res) && res.length) {
          const preds = res.map((r) => ({
            source: 'js',
            place_id: r.place_id || null,
            id_v1: null,
            main_text: r.name || '',
            secondary_text: r.formatted_address || r.vicinity || '',
          }));
          show(preds);
          return resolve(true);
        }
        resolve(false);
      });
    });

    // 4) Geocode
    const doGeocode = () => new Promise((resolve) => {
      if (!gc) return resolve(false);
      gc.geocode({ address: q, language: 'ko', region: 'KR' }, (res, st) => {
        if (st === 'OK' && Array.isArray(res) && res.length) {
          const preds = res.map((r) => ({
            source: 'gc',
            place_id: r.place_id || null,
            id_v1: null,
            main_text: r.formatted_address || q,
            secondary_text: '',
          }));
          show(preds);
          return resolve(true);
        }
        resolve(false);
      });
    });

    (async () => {
      if (await doAutocomplete()) return;
      if (await doServerSearch()) return;   // v1 결과 우선 수집(이후 역추적 폴백)
      if (await doTextSearch())  return;
      if (await doGeocode())     return;
      setMapPreds([]);
    })();
  };

  // 후보 클릭 시 지도 이동
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

    // 1) JS Place
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
      } catch {}
    }

    // 2) 서버 디테일 폴백 (pid 또는 v1id)
    const idForServer = pred?.id_v1 || pred?.place_id;
    if (idForServer) {
      try {
        const r = await fetch(`/api/places/details?id=${encodeURIComponent(idForServer)}`);
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
      } catch {}
    }

    // 3) Geocode 최후 수단
    const q = pred?.main_text;
    geocoderRef.current?.geocode({ address: q, language: 'ko', region: 'KR' }, (res, st) => {
      if (st === 'OK' && res?.[0]?.geometry?.location) {
        const loc = res[0].geometry.location;
        const pt = { lat: +loc.lat(), lng: +loc.lng() };
        setMapCenter(pt); setMapZoom(15);
        mapRef.current?.panTo(pt);
        setTempPin(pt);
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      {/* 검색 */}
      <div className="mb-4">
        <div className="text-xs mb-1">관광지/장소 검색</div>
        <input
          value={mapSearch}
          onChange={(e) => fetchMapPreds(e.target.value)}
          onFocus={() => { /* 오버레이 열기 용도 */ }}
          placeholder="예: 오사카 성, 도톤보리, 광안리 해수욕장…"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* 2/3 지도 + 1/3 후보 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="rounded-xl overflow-hidden border h-[520px]">
            {isLoaded ? (
              <GoogleMap
                onLoad={onMapLoad}
                onUnmount={() => { mapRef.current = null; }}
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={mapZoom}
                options={{ fullscreenControl:false, streetViewControl:false, mapTypeControl:false, zoomControl:true, gestureHandling:'greedy' }}
              >
                <Marker position={tempPin || mapCenter} />
              </GoogleMap>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">구글맵 로드 중…</div>
            )}
          </div>
        </div>

        {/* 후보 패널 */}
        <aside className="md:col-span-1">
          <div className="text-sm font-medium mb-2">검색 결과</div>
          <div className="space-y-2">
            {mapPreds.length === 0 && (
              <div className="text-sm text-zinc-500 border rounded-lg p-3">검색어를 입력해보세요.</div>
            )}

            {mapPreds.map((p) => {
              // ✅ 캐시 키 우선순위: v1 id → place_id
              const det = detailCache[p.id_v1] || detailCache[p.place_id] || {};
              const placeName = det.title || p.main_text || '이름 없음';
              const placeAddress = det.address || p.secondary_text || '';

              return (
                <button
                  key={`${p.id_v1 || ''}_${p.place_id || ''}_${p.main_text}_${p.secondary_text}`}
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
                        <span className="inline-block text-[11px] px-2 py-1 rounded border">지도에서 보기</span>
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
