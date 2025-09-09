// server/routes/places.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const API_KEY = process.env.GCP_API_KEY;

// Text Search
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').toString();
  if (!q.trim()) return res.status(400).json({ error: 'q required' });
  try {
    const { data } = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      { textQuery: q, languageCode: 'ko', regionCode: 'KR' },
      {
        headers: {
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.regularOpeningHours',
        },
      }
    );
    res.json(data);
  } catch (e) {
    console.error('[places:search]', e?.response?.status, e?.response?.data || e.message);
    res.status(500).json({ error: 'places search failed' });
  }
});

module.exports = router;

