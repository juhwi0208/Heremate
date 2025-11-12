// server/services/trustService.js
const db = require('../db');

/** 내부: 사용자별 아우라/별자리 캐시 갱신 */
async function recalcUserTrust(userId) {
  const conn = await db.getConnection();
  try {
    // 긍정 비율 p (자신이 받은 후기)
    const [[r0]] = await conn.query(
      `SELECT 
         SUM(CASE WHEN emotion='positive' THEN 1 ELSE 0 END) AS pos,
         COUNT(*) AS total
       FROM reviews WHERE target_id = ?`,
      [userId]
    );
    const n = Number(r0?.total || 0);
    const pos = Number(r0?.pos || 0);
    const alpha = 4;   // 가짜 표본 수 (초기 관성)
    const p0 = 0.65;   // 기본 기대 긍정률
    const p = (pos + alpha * p0) / (n + alpha);  // 0~1

    // 관계/여행 통계: U, T, P
    const [[r1]] = await conn.query(
      `SELECT 
         COUNT(DISTINCT partner_id) AS U,
         COALESCE(SUM(trips_count),0) AS T,
         AVG(NULLIF(pos_ratio,0)) AS P
       FROM travel_relations
       WHERE user_id = ?`,
      [userId]
    );
    const U = Number(r1?.U || 0);
    const T = Number(r1?.T || 0);
    const P = Number(r1?.P || 0);

    // 아우라 계산
    const weighted = p * 2 - 1; // [-1,1]
    let aura_score = Math.max(5, Math.min(95, ((weighted + 1) / 2) * 100));
    let aura_tone = 'neutral';
    if (weighted > 0.35) aura_tone = 'warm';
    else if (weighted < -0.25) aura_tone = 'cool';
    const aura_intensity = Math.max(0.25, Math.min(1, Math.abs(weighted) * 0.6 + 0.3));

    // 별자리 계산
    const constellation_score = Math.min(
      100,
      50 * (1 - Math.exp(-U / 6)) +
      35 * (1 - Math.exp(-T / 10)) +
      15 * (isFinite(P) ? P : 0)
    );

    await conn.query(
      `UPDATE users 
         SET aura_tone=?, aura_intensity=?, aura_score=?, constellation_score=?
       WHERE id=?`,
      [aura_tone, aura_intensity, aura_score, constellation_score, userId]
    );
  } finally {
    conn.release();
  }
}

/** 내부: 페어 관계 캐시 갱신 (pos_ratio, relation_strength, trips_count 등) */
async function upsertRelation(userId, partnerId, tripId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // trips_count, last_trip_date
    const [[tt]] = await conn.query(
      `SELECT COUNT(*) AS trips, MAX(end_date) AS last_date 
         FROM trips
        WHERE ((user_a=? AND user_b=?) OR (user_a=? AND user_b=?))
          AND met_at IS NOT NULL`,
      [userId, partnerId, partnerId, userId]
    );

    // 긍정 비율 (상대가 userId에게 준 후기 비율)
    const [[rv]] = await conn.query(
      `SELECT 
         SUM(CASE WHEN emotion='positive' THEN 1 ELSE 0 END) AS pos,
         COUNT(*) AS total
       FROM reviews
      WHERE target_id = ? AND reviewer_id = ?`,
      [userId, partnerId]
    );
    const pos_ratio = rv?.total ? (rv.pos / rv.total) : 0;

    // 간단한 relation_strength
    const trips = Number(tt?.trips || 0);
    const strength = (1 - Math.exp(-trips / 3)) * (0.5 + 0.5 * pos_ratio);

    await conn.query(
      `INSERT INTO travel_relations (user_id, partner_id, trips_count, last_trip_date, pos_ratio, relation_strength)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         trips_count=VALUES(trips_count),
         last_trip_date=VALUES(last_trip_date),
         pos_ratio=VALUES(pos_ratio),
         relation_strength=VALUES(relation_strength)`,
      [userId, partnerId, trips, tt?.last_date || null, pos_ratio, strength]
    );

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** 공개: 리뷰 생성/수정 후 호출 */
async function onReviewUpsert({ reviewerId, targetId, tripId }) {
  // 양방향 관계 갱신(보기 주체 기준)
  await upsertRelation(targetId, reviewerId, tripId);
  // 신뢰 캐시 재계산
  await recalcUserTrust(targetId);
}

/** 공개: 경고 발생 시 감쇠 후 재계산(간단 버전: 즉시 -10 / 아우라 -8) */
async function onWarning(userId, severity = 10) {
  const conn = await db.getConnection();
  try {
    await conn.query(
      `UPDATE users 
         SET aura_score = GREATEST(0, aura_score - 8), 
             constellation_score = GREATEST(0, constellation_score - ?)
       WHERE id = ?`,
      [Math.min(15, severity), userId]
    );
  } finally {
    conn.release();
  }
  await recalcUserTrust(userId);
}

/** 공개: 여행(메트) 확정/완료 후 관계 갱신 */
async function onTripUpdate(userA, userB, tripId) {
  await Promise.all([
    upsertRelation(userA, userB, tripId),
    upsertRelation(userB, userA, tripId),
  ]);
  await Promise.all([recalcUserTrust(userA), recalcUserTrust(userB)]);
}

module.exports = {
  recalcUserTrust,
  onReviewUpsert,
  onWarning,
  onTripUpdate,
};
