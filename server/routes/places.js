// server/routes/places.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const API_KEY = process.env.GCP_API_KEY;

// 공통 헤더
const headers = (fieldMask) => ({
  'X-Goog-Api-Key': API_KEY,
  'X-Goog-FieldMask': fieldMask,
});

// 🔹 전역/바이어스 구성
function buildLocationBias({ lat, lng, radius, global }) {
  if (global) return undefined; // 전세계 검색
  const r = Math.max(1000, Math.min(Number(radius) || 500000, 1000000)); // 1km~1000km
  return {
    circle: {
      center: { latitude: Number(lat) || 37.5665, longitude: Number(lng) || 126.9780 },
      radius: r,
    },
  };
}

// ✅ 자동완성
// GET /api/places/autocomplete?q=...&lat=..&lng=..&radius=..&global=1
router.get('/autocomplete', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ predictions: [] });

    const lat = Number(req.query.lat || 37.5665);
    const lng = Number(req.query.lng || 126.9780);
    const radius = Number(req.query.radius || 500000);
    const global = String(req.query.global || '1') === '1';

    const body = {
      input: q,
      languageCode: 'ko',
      regionCode: 'KR',
    };
    const bias = buildLocationBias({ lat, lng, radius, global });
    if (bias) body.locationBias = bias;

    const fieldMask = [
      'suggestions.placePrediction.placeId',
      'suggestions.placePrediction.text',
      'suggestions.placePrediction.structuredFormat',
    ].join(',');

    const { data } = await axios.post(
      'https://places.googleapis.com/v1/places:autocomplete',
      body,
      { headers: headers(fieldMask) }
    );

    // v3 응답을 클라에서 쓰기 쉬운 형태로 변환
    const predictions = (data?.suggestions || []).map((s) => {
      const p = s.placePrediction || {};
      // v3는 placeId가 이미 'places/...' 리소스 이름
      const id = p.placeId || null;
      const main = p.structuredFormat?.mainText?.text || p.text?.text || '';
      const secondary = p.structuredFormat?.secondaryText?.text || '';
      return {
        place_id: id, // 그대로 사용 (places/…)
        description: secondary ? `${main}, ${secondary}` : main,
        structured_formatting: {
          main_text: main,
          secondary_text: secondary,
        },
      };
    });

    res.json({ predictions });
  } catch (e) {
    console.error('[places:autocomplete]', e?.response?.status, e?.response?.data || e.message);
    res.status(500).json({ error: 'places autocomplete failed' });
  }
});

// ✅ 텍스트 검색 (v3)
// GET /api/places/search?q=...&lat=..&lng=..&radius=..&global=1
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'q required' });

  try {
    const lat = Number(req.query.lat || 37.5665);
    const lng = Number(req.query.lng || 126.9780);
    const radius = Number(req.query.radius || 500000);
    const global = String(req.query.global || '1') === '1';

    const body = {
      textQuery: q,
      languageCode: 'ko',
      regionCode: 'KR',
    };
    const bias = buildLocationBias({ lat, lng, radius, global });
    if (bias) body.locationBias = bias;

    const { data } = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      body,
      {
        headers: headers(
          [
            'places.id',
            'places.displayName',
            'places.formattedAddress',
            'places.location',
            'places.regularOpeningHours',
          ].join(',')
        ),
      }
    );

    res.json(data);
  } catch (e) {
    console.error('[places:search]', e?.response?.status, e?.response?.data || e.message);
    res.status(500).json({ error: 'places search failed' });
  }
});

router.get('/details', async (req, res) => {
  try {
    const id = String(req.query.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });

    // v3 place fetch
    const fields = [
      'id',
      'displayName',
      'formattedAddress',
      'regularOpeningHours',
      'photos'
    ].join(',');

    const { data: place } = await axios.get(
      `https://places.googleapis.com/v1/${encodeURIComponent(id)}`,
      { headers: { 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': fields } }
    );

    // 대표 사진 URL 만들기 (redirect 미디어 엔드포인트)
    let photoUrl = '';
    const ph = place?.photos?.[0];
    if (ph?.name) {
      // 예: places/XXXX/photos/YYY → media
      photoUrl = `https://places.googleapis.com/v1/${encodeURIComponent(ph.name)}/media?maxWidthPx=640&key=${API_KEY}`;
    }

    res.json({
      id: place?.id || id,
      displayName: place?.displayName,
      formattedAddress: place?.formattedAddress || '',
      regularOpeningHours: place?.regularOpeningHours || null,
      photoUrl,
    });
  } catch (e) {
    console.error('[places:details]', e?.response?.status, e?.response?.data || e.message);
    res.status(500).json({ error: 'places details failed' });
  }
});

module.exports = router;
