// server/scripts/backfillRelationsFromTrips.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.dev') });
const db = require('../db');
const trustService = require('../services/trustService');


(async () => {
  try {
    const [rows] = await db.query(`
      SELECT id, user_a, user_b
      FROM trips
      WHERE met_at IS NOT NULL
    `);

    console.log('총 met 된 trips 개수:', rows.length);

    for (const row of rows) {
      console.log('▶ trip', row.id, '에 대해 onTripUpdate 실행');
      await trustService.onTripUpdate(row.user_a, row.user_b, row.id);
    }

    console.log('✅ 완료!');
    process.exit(0);
  } catch (e) {
    console.error('백필 중 에러', e);
    process.exit(1);
  }
})();
