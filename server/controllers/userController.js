// server/controllers/userController.js
const path = require('path');
const db = require('../db');

// GET /api/users/me
exports.getMe = async (req, res) => {
  const id = req.user.id;
  try {
    const conn = await db.getConnection();
    // 옵션 A: avatar_url, bio 칼럼 사용
    const [rows] = await conn.query(
      `SELECT id, email, nickname, role, created_at AS created_at,
              avatar_url, bio
       FROM users WHERE id = ?`,
      [id]
    );
    conn.release();
    if (!rows.length) return res.status(404).json({ error: '사용자 없음' });
    const u = rows[0];
    return res.json({
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      role: u.role,
      created_at: u.created_at,
      avatarUrl: u.avatar_url || '',
      bio: u.bio || ''
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '프로필 로드 실패' });
  }
};

// PUT /api/users/me (multipart)
exports.updateMe = async (req, res) => {
  const id = req.user.id;
  const nickname = req.body.nickname ?? null;
  const bio = req.body.bio ?? null;
  const file = req.file; // avatar

  // 업로드 파일 URL
  const avatarUrl = file ? `/uploads/avatars/${file.filename}` : null;

  try {
    const conn = await db.getConnection();

    // 동적 업데이트
    const sets = [];
    const params = [];

    if (nickname !== null) { sets.push('nickname = ?'); params.push(nickname); }
    // 옵션 A
    if (bio !== null) { sets.push('bio = ?'); params.push(bio); }
    if (avatarUrl) { sets.push('avatar_url = ?'); params.push(avatarUrl); }

    if (!sets.length) {
      conn.release();
      return res.json({ message: '변경 사항 없음' });
    }

    const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = ?`;
    params.push(id);
    await conn.query(sql, params);
    conn.release();

    return res.json({ message: '프로필 저장 완료', avatarUrl });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '프로필 저장 실패' });
  }
};
