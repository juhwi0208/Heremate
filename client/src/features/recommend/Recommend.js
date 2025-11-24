// client/src/features/recommend/Recommend.js
// PlanEditor와 동일한 UsePlacesAutocomplete 파이프라인 + photoName 프록시 사용

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import CountryCitySelect from '../../components/CountryCitySelect';
import TravelRegions from '../../data/TravelRegions';
import { buildPhotoProxyURL } from '../../lib/PlacesId';
import UsePlacesAutocomplete from '../../lib/UsePlacesAutocomplete';

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
      open: p.open ? { day: p.open.day, time: toHHMM(p.open) } : undefined,
      close: p.close ? { day: p.close.day, time: toHHMM(p.close) } : undefined,
    }));
    return {
      weekdayDescriptions: base.weekdayDescriptions || [],
      periods,
    };
  } catch {
    return null;
  }
}

const defaultCenter = { lat: 37.5665, lng: 126.9780 }; // 서울

export default function Recommend() {
  const [mapCenter, setMapCenter] = useState({ lat: 37.5665, lng: 126.9780 });
  const [mapZoom, setMapZoom] = useState(12);

  // 여행 지역(PlanEditor와 동일한 구조)
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');

  // 선택한 나라/도시를 기반으로 검색 중심 좌표 계산
  const selectedCoords = useMemo(() => {
    if (!country) return null;

    const c = TravelRegions.find(
      (v) =>
        v.code === country ||
        v.name?.ko === country ||
        v.name?.en === country
    );
    if (!c) return null;

    // 도시까지 선택한 경우
    if (region && Array.isArray(c.cities)) {
      const city = c.cities.find(
        (ci) => ci.ko === region || ci.en === region
      );
      if (city && Number.isFinite(city.lat) && Number.isFinite(city.lng)) {
        return { lat: city.lat, lng: city.lng, radius: 50000 };
      }
    }

    // 나라만 선택한 경우
    if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
      return { lat: c.lat, lng: c.lng, radius: 120000 };
    }

    // 안전망: 서울
    return { ...defaultCenter, radius: 120000 };
  }, [country, region]);

  // 선택 지역이 바뀌면 지도 중심도 같이 이동
  useEffect(() => {
    if (!selectedCoords) return;
    setMapCenter({ lat: selectedCoords.lat, lng: selectedCoords.lng });
    setMapZoom(selectedCoords.radius <= 60000 ? 12 : 10);
  }, [selectedCoords]);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_LIBRARIES,
    version: 'weekly',
  });

  const mapRef = useRef(null);
  const placesSvcRef = useRef(null);
  const geocoderRef = useRef(null);

  // 검색 상태/캐시
  const [mapSearch, setMapSearch] = useState('');
  const [mapPreds, setMapPreds] = useState([]); // [{ place_id?, id_v1?, main_text, secondary_text }]
  const [detailCache, setDetailCache] = useState({}); // { [id]: {title,address,openingHours,photoUrl} }
  const [tempPin, setTempPin] = useState(null);

  const onMapLoad = (m) => {
    mapRef.current = m;
    if (window.google?.maps) {
      const anchor = m || document.createElement('div');
      if (!placesSvcRef.current) {
        placesSvcRef.current = new window.google.maps.places.PlacesService(
          anchor
        );
      }
      if (!geocoderRef.current) {
        geocoderRef.current = new window.google.maps.Geocoder();
      }
    }
  };

  // ✅ PlanEditor와 동일한 자동완성 훅 사용
  const {
    items: autoPredictions,
    loading: autoLoading,
    error: autoError,
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

  // ✅ 자동완성 결과 → Recommend 전용 mapPreds 포맷으로 정규화
  useEffect(() => {
    if (!mapSearch || autoLoading || !Array.isArray(autoPredictions)) {
      setMapPreds([]);
      return;
    }

    const norm = autoPredictions.map((item, idx) => {
      const placeId =
        item.place_id ||
        item.placeId ||
        item.id ||
        null;

      const main =
        item.structured_formatting?.main_text ||
        item.main_text ||
        item.primaryText ||
        item.description ||
        '';

      const secondary =
        item.structured_formatting?.secondary_text ||
        item.secondary_text ||
        item.secondaryText ||
        '';

      // v1 id 있으면 함께 보존
      const id_v1 =
        item.id_v1 ||
        item.idV1 ||
        (typeof item.id === 'string' && item.id.startsWith('places/')
          ? item.id
          : null);

      return {
        source: item.source || 'auto',
        place_id: placeId,
        id_v1,
        main_text: main,
        secondary_text: secondary,
        _idx: idx,
      };
    });

    setMapPreds(norm);
  }, [mapSearch, autoPredictions, autoLoading]);

  // ✅ PlanEditor와 동일한 방식으로 상세 + 썸네일 채우기
  useEffect(() => {
    const Place = window.google?.maps?.places?.Place;
    const placesSvc = placesSvcRef.current;

    const byPid = mapPreds.filter((p) => p.place_id); // place_id 가진 후보
    const byV1 = mapPreds.filter((p) => p.id_v1 && !p.place_id); // v1만 가진 후보

    // 1) place_id 보유 후보: JS SDK → (실패 시) 서버 폴백
    byPid.forEach((item) => {
      const pid = item.place_id;
      if (!pid || detailCache[pid]) return;

      (async () => {
        // 1-A) 신형 Place.fetchFields()
        if (Place) {
          try {
            const place = new Place({
              id: pid,
              requestedLanguage: 'ko',
              requestedRegion: 'KR',
            });
            const det = await place.fetchFields({
              fields: [
                'id',
                'displayName',
                'name',
                'formattedAddress',
                'regularOpeningHours',
                'photos',
                'location',
              ],
            });
            if (det) {
              const ph = det.photos?.[0];
              let url = '';
              try {
                if (ph?.getURI)
                  url = ph.getURI({ maxWidth: 400, maxHeight: 300 });
                else if (ph?.getUrl)
                  url = ph.getUrl({ maxWidth: 400, maxHeight: 300 });
                else if (ph?.getURL)
                  url = ph.getURL({ maxWidth: 400, maxHeight: 300 });
              } catch {}
              setDetailCache((prev) => ({
                ...prev,
                [pid]: {
                  title:
                    det?.displayName?.text || det?.name || item.main_text || '',
                  address:
                    det?.formattedAddress || item.secondary_text || '',
                  openingHours: normalizeOpeningHours(
                    det?.regularOpeningHours || null
                  ),
                  photoUrl: url || '',
                },
              }));
              if (url) return; // 사진 얻었으면 끝
            }
          } catch {}
        }

        // 1-B) 서버 폴백
        try {
          const resp = await fetch(
            `/api/places/details?id=${encodeURIComponent(pid)}`
          );
          if (resp.ok) {
            const det = await resp.json();

            // ✅ PlanEditor와 동일한 photoName → /api/places/photo 프록시 사용
            let photoUrl = '';
            if (det?.photoName) {
              photoUrl = buildPhotoProxyURL({
                name: det.photoName,
                w: 400,
                h: 300,
              });
            } else if (det?.photoUrl) {
              photoUrl = det.photoUrl;
            }

            setDetailCache((prev) => ({
              ...prev,
              [pid]: {
                title:
                  det?.displayName?.text || det?.name || item.main_text || '',
                address: det?.formattedAddress || item.secondary_text || '',
                openingHours: normalizeOpeningHours(
                  det?.regularOpeningHours || null
                ),
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
          const resp = await fetch(
            `/api/places/details?id=${encodeURIComponent(v1id)}`
          );
          if (resp.ok) {
            const det = await resp.json();

            let photoUrl = '';
            if (det?.photoName) {
              photoUrl = buildPhotoProxyURL({
                name: det.photoName,
                w: 400,
                h: 300,
              });
            } else if (det?.photoUrl) {
              photoUrl = det.photoUrl;
            }

            setDetailCache((prev) => ({
              ...prev,
              [v1id]: {
                title:
                  det?.displayName?.text || det?.name || item.main_text || '',
                address: det?.formattedAddress || item.secondary_text || '',
                openingHours: normalizeOpeningHours(
                  det?.regularOpeningHours || null
                ),
                photoUrl: photoUrl || '',
              },
            }));
            if (photoUrl) return; // 서버가 사진까지 주면 종료
          }
        } catch {}

        // 2-B) 서버가 사진 못 줄 때: JS TextSearch → JS Place 사진
        const svc = placesSvcRef.current;
        if (!svc) return;

        try {
          const res = await new Promise((resolve) => {
            svc.textSearch(
              {
                query: item.main_text || '',
                language: 'ko',
                region: 'KR',
              },
              (r, st) => {
                if (
                  st === 'OK' &&
                  Array.isArray(r) &&
                  r.length &&
                  r[0]?.place_id
                ) {
                  resolve(r[0]);
                } else {
                  resolve(null);
                }
              }
            );
          });

          if (res?.place_id) {
            const pid = res.place_id;
            const Place = window.google?.maps?.places?.Place;
            if (Place) {
              try {
                const place = new Place({
                  id: pid,
                  requestedLanguage: 'ko',
                  requestedRegion: 'KR',
                });
                const det = await place.fetchFields({
                  fields: [
                    'id',
                    'displayName',
                    'name',
                    'formattedAddress',
                    'regularOpeningHours',
                    'photos',
                    'location',
                  ],
                });
                if (det) {
                  const ph = det.photos?.[0];
                  let url = '';
                  try {
                    if (ph?.getURI)
                      url = ph.getURI({ maxWidth: 400, maxHeight: 300 });
                    else if (ph?.getUrl)
                      url = ph.getUrl({ maxWidth: 400, maxHeight: 300 });
                    else if (ph?.getURL)
                      url = ph.getURL({ maxWidth: 400, maxHeight: 300 });
                  } catch {}
                  setDetailCache((prev) => ({
                    ...prev,
                    [v1id]: {
                      title:
                        det?.displayName?.text ||
                        det?.name ||
                        item.main_text ||
                        '',
                      address:
                        det?.formattedAddress || item.secondary_text || '',
                      openingHours: normalizeOpeningHours(
                        det?.regularOpeningHours || null
                      ),
                      photoUrl: url || '',
                    },
                  }));
                }
              } catch {}
            }
          }
        } catch {}
      })();
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapPreds]);

  // ✅ 이제 fetchMapPreds는 그냥 검색어 state만 관리
  const fetchMapPreds = (q) => {
    setMapSearch(q);
  };

  // 후보 클릭 시 지도 이동
  const panToPred = async (pred) => {
    const Place = window.google?.maps?.places?.Place;
    const pid = pred?.place_id;

    const pickLatLng = (loc) => {
      if (!loc) return null;
      if (
        typeof loc.lat === 'function' &&
        typeof loc.lng === 'function'
      )
        return { lat: +loc.lat(), lng: +loc.lng() };
      if (loc.lat != null && loc.lng != null)
        return { lat: +loc.lat, lng: +loc.lng };
      return null;
    };

    // 1) place_id가 있는 경우: Place/Geocode로 좌표 얻기
    if (pid && Place) {
      try {
        const place = new Place({
          id: pid,
          requestedLanguage: 'ko',
          requestedRegion: 'KR',
        });
        const det = await place.fetchFields({ fields: ['location'] });
        const pt = pickLatLng(det?.location);
        if (pt && mapRef.current) {
          mapRef.current.panTo(pt);
          setTempPin(pt);
          return;
        }
      } catch {}
    }

    // 2) Geocode 텍스트로 좌표 얻기
    const gc = geocoderRef.current;
    if (gc) {
      try {
        const res = await new Promise((resolve) => {
          gc.geocode(
            {
              address: pred.main_text || '',
              language: 'ko',
              region: 'KR',
            },
            (r, st) => {
              if (
                st === 'OK' &&
                Array.isArray(r) &&
                r.length &&
                r[0]?.geometry?.location
              )
                resolve(r[0]);
              else resolve(null);
            }
          );
        });
        const pt = pickLatLng(res?.geometry?.location);
        if (pt && mapRef.current) {
          mapRef.current.panTo(pt);
          setTempPin(pt);
        }
      } catch {}
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      {/* 여행 지역 선택 */}
      <div className="mb-4">
        <div className="text-xs mb-1">여행 지역</div>
        <CountryCitySelect
          country={country}
          region={region}
          onChangeCountry={(c) => {
            setCountry(c);
            setRegion('');
          }}
          onChangeRegion={(r) => setRegion(r)}
        />
      </div>

      {/* 검색 */}
      <div className="mb-4">
        <div className="text-xs mb-1">관광지/장소 검색</div>
        <input
          value={mapSearch}
          onChange={(e) => fetchMapPreds(e.target.value)}
          onFocus={() => {
            /* 필요하면 세션 초기화 용도로 resetSession 같은 걸 사용할 수 있음 */
          }}
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
                onUnmount={() => {
                  mapRef.current = null;
                }}
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={mapZoom}
                options={{
                  streetViewControl: false,
                  fullscreenControl: false,
                  mapTypeControl: false,
                  clickableIcons: false,
                }}
              >
                {/* 임시 핀 */}
                {tempPin && (
                  <Marker
                    position={tempPin}
                    icon={{
                      path: window.google?.maps?.SymbolPath?.CIRCLE,
                      scale: 6,
                      fillColor: '#10b981',
                      fillOpacity: 1,
                      strokeWeight: 2,
                      strokeColor: '#ffffff',
                    }}
                  />
                )}
              </GoogleMap>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-zinc-500">
                지도를 불러오는 중…
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽 후보 리스트 */}
        <aside className="border rounded-xl p-3 h-[520px] overflow-y-auto bg-white">
          {mapPreds.length === 0 ? (
            <div className="text-xs text-zinc-400">
              검색어를 입력하면 추천 장소가 여기에 표시됩니다.
            </div>
          ) : (
            <div className="text-xs text-zinc-500 mb-2">
              검색 결과 {mapPreds.length}건
            </div>
          )}

          <div className="space-y-3">
            {mapPreds.map((p, idx) => {
              const key = p.id_v1 || p.place_id || `row-${idx}`;
              const detail = detailCache[p.id_v1 || p.place_id] || {};
              const thumb = detail.photoUrl;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => panToPred(p)}
                  className="w-full text-left"
                >
                  <div className="flex gap-3 p-2 rounded-lg hover:bg-zinc-50">
                    <div className="w-20 h-20 rounded-md bg-zinc-100 overflow-hidden flex-shrink-0">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={detail.title || p.main_text}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-400">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-900 truncate">
                        {detail.title || p.main_text}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        {detail.address || p.secondary_text}
                      </div>
                      <div className="mt-1 text-[10px] text-zinc-400">
                        {detail.openingHours?.weekdayDescriptions?.[0] ||
                          '영업시간 정보 없음'}
                      </div>
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
