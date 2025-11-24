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

// ✅ 공개: 마이페이지 신뢰 지표 + 후기 키워드 조회
// 후기, 아우라, 별자리, 후기 키워드까지 한 번에 내려주는 프로필 조회
async function getUserTrustProfile(userId) {
  // 1) users 요약 정보
  const [[summary]] = await db.query(
    `
    SELECT 
      aura_tone,
      aura_intensity,
      aura_score,
      constellation_score,
      warnings_count,
      trip_count,
      positive_trip_count
    FROM users
    WHERE id = ?
    `,
    [userId]
  );

  // 2) 리뷰 감정 집계
  const [[reviewAgg]] = await db.query(
    `
    SELECT
      COUNT(*) AS reviewCount,
      SUM(CASE WHEN emotion = 'positive' THEN 1 ELSE 0 END) AS positiveCount
    FROM reviews
    WHERE target_id = ?
    `,
    [userId]
  );

  // 3) 리뷰 키워드(tags) 집계
  const [tagRows] = await db.query(
    `
    SELECT tags
    FROM reviews
    WHERE target_id = ?
      AND tags IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 200
    `,
    [userId]
  );

  const tagMap = new Map();

  for (const row of tagRows) {
    if (!row.tags) continue;

    let list;
    try {
      // reviews.tags 컬럼에는 JSON 배열(string)로 저장되어 있음: ["시간 약속을 잘 지켰어요", ...]
      list = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
    } catch (e) {
      console.error('trustService: tags JSON 파싱 실패', row.tags, e);
      continue;
    }
    if (!Array.isArray(list)) continue;

    for (const tag of list) {
      if (!tag || typeof tag !== 'string') continue;
      const trimmed = tag.trim();
      if (!trimmed) continue;
      tagMap.set(trimmed, (tagMap.get(trimmed) || 0) + 1);
    }
  }

  // count 순으로 정렬해서 상위 8개만 사용
  const topTags = Array.from(tagMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({
      label,
      count,
    }));

  const reviewCount = reviewAgg?.reviewCount || 0;
  const positivePercent =
    reviewCount > 0
      ? Math.round(((reviewAgg.positiveCount || 0) / reviewCount) * 100)
      : 0;

  return {
    auraTone: summary?.aura_tone || 'neutral',
    auraIntensity: summary?.aura_intensity || 0,
    auraScore: summary?.aura_score || 0,
    constellationScore: summary?.constellation_score || 0,
    warningsCount: summary?.warnings_count || 0,
    tripCount: summary?.trip_count || 0,
    positiveTripCount: summary?.positive_trip_count || 0,

    reviewCount,
    positivePercent,

    // 마이페이지 “후기 키워드”에서 쓸 값
    topTags, // [{ label: '시간 약속을 잘 지켰어요', count: 3 }, ...]
  };
}

module.exports = {
  recalcUserTrust,
  onReviewUpsert,
  onWarning,
  onTripUpdate,
  getUserTrustProfile,
};
