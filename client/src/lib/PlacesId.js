// src/lib/placesId.js

/**
 * Places API v1/v3 혼용 환경에서 ID를 일관된 v3 스타일("places/<id>")로 정규화합니다.
 * 서버/클라이언트 어디서 오더라도, 이 유틸로 한 번 감싸 쓰면 안전합니다.
 */

/**
 * 문자열이 v3 프리픽스("places/")를 포함하는지 확인
 */
export function hasPlacesPrefix(id = '') {
  return typeof id === 'string' && id.startsWith('places/');
}

/**
 * v1(레거시) place_id 또는 v3 id를 받아 항상 "places/<token>" 형태로 반환
 * - 입력 예: "ChIJxxxx..."  -> "places/ChIJxxxx..."
 * - 입력 예: "places/ChIJxxxx..." -> 그대로
 */
export function toPlacesId(input) {
  if (!input) return '';

  // 객체(PlaceResult/Prediction 등)에서 추출
  if (typeof input === 'object') {
    // Google JS SDK의 AutocompletePrediction(v3) 형태
    const v3 = input?.placePrediction?.placeId || input?.placePrediction?.place_id;
    if (v3) return hasPlacesPrefix(v3) ? v3 : `places/${v3}`;

    // 과거 PlaceResult 형태
    const legacy = input.place_id || input.placeId || input.id;
    if (legacy) return hasPlacesPrefix(legacy) ? legacy : `places/${legacy}`;

    // 서버에서 내려준 통합 스키마
    if (typeof input.name === 'string') {
      // v3 place.name 이 보통 "places/<token>"
      return hasPlacesPrefix(input.name) ? input.name : `places/${input.name}`;
    }
    return '';
  }

  // 문자열인 경우
  const id = String(input);
  return hasPlacesPrefix(id) ? id : `places/${id}`;
}

/**
 * Autocomplete/검색 후보 객체에서 v3형 placeId 추출('places/...'로 반환)
 */
export function pickPredictionId(pred) {
  if (!pred) return '';
  // v3 autocomplete
  const v3 = pred?.placePrediction?.placeId || pred?.placePrediction?.place_id;
  if (v3) return hasPlacesPrefix(v3) ? v3 : `places/${v3}`;

  // v1 예비 대응
  const legacy = pred.place_id || pred.placeId || pred.id;
  if (legacy) return hasPlacesPrefix(legacy) ? legacy : `places/${legacy}`;

  // 서버 통합 스키마
  if (typeof pred.name === 'string') {
    return hasPlacesPrefix(pred.name) ? pred.name : `places/${pred.name}`;
  }
  return '';
}

/**
 * Place Details 응답에서 대표 사진 name 추출(없으면 '')
 * - v3: place.photos[n].name 에 "places/<...>/photos/<...>" 형태로 담김
 */
export function pickPhotoName(place) {
  const ph = place?.photos?.[0];
  return typeof ph?.name === 'string' ? ph.name : '';
}

/**
 * 클라이언트에서 서버 프록시로 사진 요청할 URL을 만들어줍니다.
 * - 서버 엔드포인트: /api/places/photo?name=...&w=...&h=...
 * - name 은 반드시 v3 형식("places/.../photos/...") 이어야 함
 */
export function buildPhotoProxyURL({ name, w = 640, h = 480 } = {}) {
  if (!name) return '';
  const params = new URLSearchParams({ name, w: String(w), h: String(h) });
  return `/api/places/photo?${params.toString()}`;
}
