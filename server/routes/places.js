// server/routes/places.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const API_KEY = process.env.GCP_API_KEY;
if (!API_KEY) {
  console.warn('[places] GCP_API_KEY not set. Set process.env.GCP_API_KEY');
}

// ✔ Text Search 용 헤더 (places.* 접두사 필요)
const SEARCH_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Goog-Api-Key': API_KEY,
  'X-Goog-FieldMask': [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.regularOpeningHours',
    'places.photos',
    'places.googleMapsUri',
  ].join(','),
};

// ✔ Details 용 헤더 (접두사 없이 단일 필드)
const DETAILS_HEADERS = {
  'X-Goog-Api-Key': API_KEY,
  'X-Goog-FieldMask': [
    'id',
    'displayName',
    'formattedAddress',
    'location',
    'regularOpeningHours',
    'photos',
    'googleMapsUri',
  ].join(','),
};

// --- Text Search ---
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'q required' });

    const { data } = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      {
        textQuery: q,
        languageCode: 'ko',
        regionCode: 'KR',
        // locationBias 등 필요시 추가
      },
      { headers: SEARCH_HEADERS, timeout: 10000 }
    );

    const places = (data?.places || []).map((p) => ({
      id: p.id,
      displayName: p.displayName,
      formattedAddress: p.formattedAddress,
      location: p.location, // { latitude, longitude }
      regularOpeningHours: p.regularOpeningHours || null,
      photos: p.photos || [],
      googleMapsUri: p.googleMapsUri || '',
    }));

    return res.json({ places });
  } catch (e) {
    const status = e?.response?.status;
    const detail = e?.response?.data || e.message;
    console.error('[places:search]', status, detail);
    return res.status(502).json({ error: 'places search failed', status, detail });
  }
});

// --- Details (단일 place) ---
router.get('/details', async (req, res) => {
  try {
    const id = (req.query.id || '').toString().trim();
    if (!id) return res.status(400).json({ error: 'id required' });

    const url =
      `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}` +
      `?languageCode=ko&regionCode=KR`;

    const { data } = await axios.get(url, { headers: DETAILS_HEADERS, timeout: 10000 });

    const det = {
      id: data.id,
      displayName: data.displayName,
      formattedAddress: data.formattedAddress,
      location: data.location, // { latitude, longitude }
      regularOpeningHours: data.regularOpeningHours || null,
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
