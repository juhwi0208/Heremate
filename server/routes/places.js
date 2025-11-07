// server/routes/places.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.GCP_API_KEY;

if (!API_KEY) {
  console.warn('[places] WARNING: GOOGLE_MAPS_API_KEY (or GCP_API_KEY) not set.');
}

// 공통 POST JSON 유틸
async function postJSON(url, body, fieldMask) {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Goog-Api-Key': API_KEY,
      ...(fieldMask ? { 'X-Goog-FieldMask': fieldMask } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = json?.error?.message || json?.message || r.statusText;
    const code = json?.error?.code || r.status;
    const err = new Error(`[Places] ${code} ${msg}`);
    err.code = code;
    err.detail = json;
    throw err;
  }
  return json;
}

// 항상 "places/XXXX" 포맷으로
function normalizePlaceResourceId(idOrName) {
  if (!idOrName) return null;
  const s = String(idOrName);
  return s.startsWith('places/') ? s : `places/${s}`;
}

/**
 * GET /api/places/autocomplete?q=&lat=&lng=&radius=&global=
 */
// ✅ 자동완성 라우트 교체
router.get('/autocomplete', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const languageCode = String(req.query.lang || 'ko');
    const regionCode = String(req.query.region || 'KR');

    // 클라에서 넘겨준 지역 좌표 (도쿄/오사카/서울…)
    const lat = Number(req.query.lat || 37.5665);
    const lng = Number(req.query.lng || 126.9780);
    const radius = Math.min(Number(req.query.radius || 50000), 150000);

    // 세션 토큰(있으면 과금 묶임)
    const sessionToken = String(req.query.sessionToken || '');

    if (!q) {
      return res.json({ predictions: [] });
    }
    if (!API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY not set' });
    }

    // 구글에 보낼 바디
    const body = {
      input: q,
      languageCode,
      regionCode,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radius,
        },
      },
    };

    if (sessionToken) {
      body.sessionToken = sessionToken;
    }

    // ✅ axios로 직접 호출 (여기가 포인트)
    const gRes = await axios.post(
      'https://places.googleapis.com/v1/places:autocomplete',
      body,
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Goog-Api-Key': API_KEY,
          // ❗ v1은 이 헤더에 정확한 문자열이 들어가야 함
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        // 혹시 프록시나 인증 이슈 있을 때 타임아웃 짧게
        timeout: 6000,
      }
    );

    const suggestions = Array.isArray(gRes.data?.suggestions)
      ? gRes.data.suggestions
      : [];

    // 도쿄 디즈니랜드 같은 걸 앞쪽으로
    const qLower = q.toLowerCase();
    suggestions.sort((a, b) => {
      const ta =
        (a.placePrediction?.text?.text ||
          a.placePrediction?.structuredFormat?.mainText?.text ||
          '')?.toLowerCase() || '';
      const tb =
        (b.placePrediction?.text?.text ||
          b.placePrediction?.structuredFormat?.mainText?.text ||
          '')?.toLowerCase() || '';
      const ia = ta.indexOf(qLower);
      const ib = tb.indexOf(qLower);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const predictions = suggestions.map((s) => {
      const pred = s.placePrediction || {};
      const main =
        pred.text?.text ||
        pred.structuredFormat?.mainText?.text ||
        '';
      const secondary =
        pred.structuredFormat?.secondaryText?.text || '';
      return {
        id: pred.placeId ? `places/${pred.placeId}` : null,
        name: main,
        formattedAddress: secondary,
      };
    });

    return res.json({ predictions });
  } catch (err) {
    console.error('[places:autocomplete] error →', err?.response?.status, err?.response?.data || err.message);

    // 구글이 뭐라고 했는지 그대로 보여주면 디버깅 쉬움
    return res.status(502).json({
      error: 'places autocomplete failed',
      upstreamStatus: err?.response?.status || null,
      upstreamData: err?.response?.data || null,
      message: err.message,
    });
  }
});



/**
 * GET /api/places/search?q=&lat=&lng=&radius=&global=
 */
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const lat = Number(req.query.lat || 37.5665);
    const lng = Number(req.query.lng || 126.9780);
    const radius = Number(req.query.radius || 500000);
    const global = req.query.global !== '0';

    if (!q) return res.json({ places: [] });

    const body = {
      textQuery: q,
      languageCode: 'ko',
      regionCode: 'KR',
    };

    if (!global) {
      body.locationBias = {
        circle: { center: { latitude: lat, longitude: lng }, radius },
      };
    }

    const json = await postJSON(
      'https://places.googleapis.com/v1/places:searchText',
      body,
      [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        // 🟢 정규/현재 영업시간 모두 요청 (어느 쪽이든 오도록)
        'places.regularOpeningHours.periods',
        'places.regularOpeningHours.weekdayDescriptions',
        'places.currentOpeningHours.periods',
        'places.currentOpeningHours.weekdayDescriptions',
        'places.photos',
        'places.googleMapsUri',
      ].join(',')
    )

    const places = (json.places || []).map((p) => ({
      id: normalizePlaceResourceId(p?.id),
      name: p?.displayName?.text || '',
      formattedAddress: p?.formattedAddress || '',
      location: p?.location || null,
      regularOpeningHours: p?.regularOpeningHours || p?.currentOpeningHours || null,
      photos: p?.photos || [],
      googleMapsUri: p?.googleMapsUri || '',
    }));

    res.json({ places });
  } catch (e) {
    console.error('[places:search]', e.code, e.detail || e.message);
    res
      .status(502)
      .json({ error: 'places search failed', code: e.code, detail: e.detail });
  }
});

/**
 * GET /api/places/details?id=
 */
router.get('/details', async (req, res) => {
  try {
    const idRaw = String(req.query.id || '').trim();
    const id = normalizePlaceResourceId(idRaw);
    if (!id) return res.status(400).json({ error: 'id required' });

    const fieldMask = [
      'id',
      'displayName',
      'formattedAddress',
      'location',
      'regularOpeningHours.periods',
      'regularOpeningHours.weekdayDescriptions',
      'currentOpeningHours.periods',
      'currentOpeningHours.weekdayDescriptions',
      'photos',
      'googleMapsUri',
    ].join(',');

    // ✅ URL에서 fields= 제거 (헤더로 보냄)
    const url = `https://places.googleapis.com/v1/${id}?languageCode=ko&regionCode=KR`;

    const r = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': fieldMask,     // ✅ 핵심
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('[places:details fail]', r.status, data?.error?.message);
      const msg = data?.error?.message || r.statusText;
      const code = data?.error?.code || r.status;
      const err = new Error(`[Places] ${code} ${msg}`);
      err.code = code;
      err.detail = data;
      throw err;
    }

    // ─────────────────────────────────────────────────────────
   // 🟢 폴백 1단계: fetchPlace가 영업시간을 못 줄 경우 searchText로 보강
   let opening =
     data?.regularOpeningHours || data?.currentOpeningHours || null;
   if (!opening) {
     const textQuery =
       (data?.displayName?.text || data?.displayName || '').trim() ||
       (data?.formattedAddress || '').trim() ||
       id; // 마지막 수단

     try {
       const fb = await postJSON(
        'https://places.googleapis.com/v1/places:searchText',
         {
           textQuery,
           languageCode: 'ko',
           regionCode: 'KR',
         },
         [
           'places.id',
           'places.regularOpeningHours.periods',
           'places.regularOpeningHours.weekdayDescriptions',
           'places.currentOpeningHours.periods',
           'places.currentOpeningHours.weekdayDescriptions',
         ].join(',')
       );

       const list = Array.isArray(fb?.places) ? fb.places : [];
       // 동일 id 우선, 없으면 첫 항목
       const same = list.find(p => (p?.id && normalizePlaceResourceId(p.id) === normalizePlaceResourceId(data?.id)));
       const pick = same || list[0] || null;
       if (pick) {
         opening = pick?.regularOpeningHours || pick?.currentOpeningHours || null;
       }
     } catch (fbErr) {
       console.warn('[places:details fallback searchText failed]', fbErr?.code || '', fbErr?.message || '');
     }
   }
   // ─────────────────────────────────────────────────────────

    const photoName = data?.photos?.[0]?.name || '';
    const photoUrl = photoName
      ? `/api/places/photo?name=${encodeURIComponent(photoName)}&w=640&h=480`
      : '';

    res.json({
      id: normalizePlaceResourceId(data?.id),
      displayName: data?.displayName || null,
      formattedAddress: data?.formattedAddress || '',
      location: data?.location || null,
      // ✅ regular || current 폴백 유지
      regularOpeningHours: opening || null,
      googleMapsUri: data?.googleMapsUri || '',
      photoName,
      photoUrl,
    });
  } catch (e) {
    console.error('[places:details]', e.code, e.detail || e.message);
    res
      .status(502)
      .json({ error: 'places details failed', code: e.code, detail: e.detail });
  }
});


router.get('/photo', async (req, res) => {
  try {
    const rawName = req.query.name;
    if (!rawName) return res.status(400).json({ error: 'name required' });

    // ✅ URL 디코딩
    const decoded = decodeURIComponent(rawName);
    // ✅ "places/.../photos/..." 구조 유지 (placeId + photoId 포함)
    const nameParts = decoded.split('/photos/');
    if (nameParts.length !== 2)
      return res.status(400).json({ error: 'invalid photo name format' });

    const placeIdPart = nameParts[0]; // e.g. "places/ChIJxxxx"
    const photoIdPart = nameParts[1]; // e.g. "AWn5SUxxxx"

    const w = Number(req.query.w) || 640;
    const h = Number(req.query.h) || 480;

    // ✅ 올바른 Google API URL 생성
    const url = `https://places.googleapis.com/v1/${placeIdPart}/photos/${photoIdPart}/media?maxWidthPx=${w}&maxHeightPx=${h}`;

    const r = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
      },
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('[places:photo]', r.status, txt);
      return res.status(r.status).json({ error: 'fetch photo failed' });
    }

    const buf = await r.arrayBuffer();

    // ✅ Content-Type / 캐시 / 응답 처리
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('[places:photo error]', e.message);
    res.status(500).json({ error: 'fetch photo failed' });
  }
});

module.exports = router;

