// server/scripts/rebuildTravelRelations.js

// 🔥 먼저 .env.dev 로드 (DB_USER, DB_PASSWORD 등 환경변수 설정)
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '..', '.env.dev'), // 네가 쓰는 실제 env 파일 이름
});

const db = require('../db');
const trustService = require('../services/trustService');

(async () => {
  const conn = await db.getConnection();
  try {
    console.log('🔄 travel_relations 전체 초기화 시작');

    // 1) 기존 관계 비우기
    await conn.query('TRUNCATE TABLE travel_relations');
    console.log('✅ travel_relations 비움');

    // 2) met_at이 있는 여행만 동행 완료로 판단
    const [rows] = await conn.query(`
      SELECT 
        LEAST(user_a, user_b) AS a,
        GREATEST(user_a, user_b) AS b
      FROM trips
      WHERE met_at IS NOT NULL
      GROUP BY LEAST(user_a, user_b), GREATEST(user_a, user_b)
    `);

    console.log('📌 동행 관계 쌍 개수:', rows.length);

    // 3) 각 사용자 쌍에 대해 관계/신뢰도 재계산
    for (const row of rows) {
      console.log('▶ 관계 재계산:', row.a, '<->', row.b);
      // tripId는 여기서 중요하지 않으니 null
      await trustService.onTripUpdate(row.a, row.b, null);
    }

    console.log('🎉 모든 관계 재빌드 완료!');
    conn.release();
    process.exit(0);
  } catch (e) {
    console.error('❌ 재빌드 중 에러', e);
    conn.release();
    process.exit(1);
  }
})();
