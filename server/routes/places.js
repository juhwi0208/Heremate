// server/routes/places.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const API_KEY = process.env.GCP_API_KEY;

// 안전장치: 서버 키 없으면 바로 에러
if (!API_KEY) {
  console.warn('[places] GCP_API_KEY not set. Set process.env.GCP_API_KEY');
}

// 공통 헤더 (Places API v1)
const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Goog-Api-Key': API_KEY,
  // 필드마스크: 공식명/주소/좌표/영업시간/사진/맵 링크까지
  'X-Goog-FieldMask':
    'places.id,places.displayName,places.formattedAddress,places.location,' +
    'places.regularOpeningHours,places.photos,places.googleMapsUri',
};

// Text Search (신형 Places API v1)
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'q required' });

    const url = 'https://places.googleapis.com/v1/places:searchText';

    // 필요하면 적당히 locationBias 넣어줌(한국 기준 예시, 원하는 대로 조정 가능)
    const body = {
      textQuery: q,
      languageCode: 'ko',
      regionCode: 'KR',
      // locationBias: { circle: { center: { latitude: 37.5665, longitude: 126.9780 }, radius: 5_000_000 } }
    };

    const { data } = await axios.post(url, body, { headers: HEADERS, timeout: 10000 });

    // ✔ 클라이언트가 기대하는 형태로 정규화해서 반환 (중요!)
    const places = (data?.places || []).map((p) => ({
      id: p.id,
      displayName: p.displayName,            // { text, languageCode }
      formattedAddress: p.formattedAddress,  // 문자열
      location: p.location,                  // { latitude, longitude }
      regularOpeningHours: p.regularOpeningHours,
      photos: p.photos || [],
      googleMapsUri: p.googleMapsUri || '',
    }));

    return res.json({ places });
  } catch (e) {
    const status = e?.response?.status;
    const detail = e?.response?.data || e.message;
    console.error('[places:search]', status, detail);
    // 클라이언트 디버깅에 도움되게 status/상세를 그대로 넘겨줌
    return res.status(502).json({ error: 'places search failed', status, detail });
  }
});

// 상세 조회 (place id 기반) — 후보 카드 프리패치/일정추가/지도보기 폴백에 사용
router.get('/details', async (req, res) => {
  try {
    const id = (req.query.id || '').toString().trim();
    if (!id) return res.status(400).json({ error: 'id required' });

    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=ko&regionCode=KR`;
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });

    // 필요 시 그대로 내려도 되지만, 프런트 일관성을 위해 약하게 정규화
    const det = {
      id: data.id,
      displayName: data.displayName,
      formattedAddress: data.formattedAddress,
      location: data.location,
      regularOpeningHours: data.regularOpeningHours,
      photos: data.photos || [],
      googleMapsUri: data.googleMapsUri || '',
    };

    return res.json(det);
  } catch (e) {
    const status = e?.response?.status;
    const detail = e?.response?.data || e.message;
    console.error('[places:details]', status, detail);
    return res.status(502).json({ error: 'places details failed', status, detail });
  }
});

module.exports = router;
