// server/controllers/reportController.js
const db = require('../db');
const trust = require('../services/trustService');

const WEIGHT = { spam:2, abuse:4, noshow:6, scam:10, nsfw:10, etc:1 };

exports.create = async (req, res) => {
  const reporterId = req.user.id;
  const { target_user_id, context, reason, ref_id, detail } = req.body || {};
  if (!target_user_id || !context || !reason) {
    return res.status(400).json({ error: 'target_user_id, context, reason은 필수입니다.' });
  }
  const severity = WEIGHT[reason] || 1;

  const conn = await db.getConnection();
  try {
    // 동일 신고자→동일 대상 7일 내 1회 제한
    await conn.query(
      `INSERT INTO reports (
        reporter_id,
        target_user_id,
        context,
        reason,
        ref_id,
        severity,
        status,
        detail
      ) VALUES (?,?,?,?,?,?, 'pending', ?)`,
      [
        reporterId,
        target_user_id,
        context,
        reason,
        ref_id || null,
        severity,
        detail || null,
      ]
    );

    conn.release();
    return res.json({ ok: true });
  } catch (e) {
    try { conn.release(); } catch {}
    console.error('report create error', e);
    return res.status(500).json({ error: '신고 접수 실패' });
  }
};

exports.resolve = async (req, res) => {
  // 관리자용
  const id = req.params.id;
  const { status, severity, warning } = req.body || {};
  if (!['approved','rejected'].includes(status)) {
    return res.status(400).json({ error: 'status 값이 올바르지 않습니다.' });
  }

  const conn = await db.getConnection();
  try {
    const [[r]] = await conn.query('SELECT target_user_id, severity FROM reports WHERE id=?', [id]);
    if (!r) { conn.release(); return res.status(404).json({ error: 'report가 없습니다.' }); }

    await conn.beginTransaction();
    await conn.query('UPDATE reports SET status=? WHERE id=?', [status, id]);

    if (status === 'approved' && warning) {
      const sev = Number(severity ?? r.severity ?? 5);
      await conn.query(
        `INSERT INTO warnings (user_id, reason, severity, created_at)
         VALUES (?, 'report_approved', ?, NOW())`,
        [r.target_user_id, sev]
      );
    }
    await conn.commit();
    conn.release();

    if (status === 'approved' && warning) {
      await trust.onWarning(r.target_user_id, severity);
    }

    return res.json({ ok: true });
  } catch (e) {
    try { await conn.rollback(); conn.release(); } catch {}
    console.error('report resolve error', e);
    return res.status(500).json({ error: '처리 실패' });
  }
};
