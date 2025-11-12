// server/controllers/reviewController.js
const db = require('../db');
const trust = require('../services/trustService');

exports.createOrUpdate = async (req, res) => {
  const reviewerId = req.user.id;
  const { target_id, trip_id, emotion, tags, comment } = req.body || {};

  if (!target_id || !trip_id || !emotion) {
    return res.status(400).json({ error: 'target_id, trip_id, emotion은 필수입니다.' });
  }
  if (!['positive','neutral','negative'].includes(emotion)) {
    return res.status(400).json({ error: 'emotion 값이 올바르지 않습니다.' });
  }

  const conn = await db.getConnection();
  try {
    // trip 유효성 및 참여자 검증
    const [[t]] = await conn.query('SELECT user_a, user_b, end_date, met_at FROM trips WHERE id=?', [trip_id]);
    if (!t) { conn.release(); return res.status(404).json({ error: 'trip이 없습니다.' }); }
    if (!(t.user_a === reviewerId || t.user_b === reviewerId)) {
      conn.release(); return res.status(403).json({ error: '이 trip에 대한 리뷰 권한이 없습니다.' });
    }
    if (!t.met_at) { conn.release(); return res.status(400).json({ error: '동행이 확정된 trip만 후기 작성 가능' }); }

    // upsert (reviewer_id, target_id, trip_id) 유니크
    await conn.query(
      `INSERT INTO reviews (reviewer_id, target_id, trip_id, emotion, tags, comment)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE emotion=VALUES(emotion), tags=VALUES(tags), comment=VALUES(comment)`,
      [reviewerId, target_id, trip_id, emotion, tags ? JSON.stringify(tags) : null, comment || null]
    );
    conn.release();

    // 신뢰 갱신
    await trust.onReviewUpsert({ reviewerId, targetId: target_id, tripId: trip_id });

    return res.json({ ok: true });
  } catch (e) {
    try { conn.release(); } catch {}
    console.error('review upsert error', e);
    return res.status(500).json({ error: '후기 저장 실패' });
  }
};
