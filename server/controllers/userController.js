// server/controllers/userController.js
// server/controllers/userController.js
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../db');

// GET /api/users/me  → kakaoId, created_at 포함
exports.getMe = async (req, res) => {
  const id = req.user.id;
  try {
    const conn = await db.getConnection();
    const [rows] = await conn.query(
      `SELECT id, email, nickname, role, created_at, avatar_url, bio, kakao_id, email_verified
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
      bio: u.bio || '',
      kakaoId: u.kakao_id || null,
      emailVerified: !!u.email_verified,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '프로필 로드 실패' });
  }
};

// PUT /api/users/me (multipart)  → 이메일 변경 지원
// body: nickname?, bio?, email?, currentPassword?
exports.updateMe = async (req, res) => {
  const id = req.user.id;
  const nickname = req.body.nickname ?? null;
  const bio = req.body.bio ?? null;
  const newEmail = req.body.email ?? null;
  const currentPassword = req.body.currentPassword ?? null;
  const file = req.file; // avatar

  const avatarUrl = file ? `/uploads/avatars/${file.filename}` : null;

  try {
    const conn = await db.getConnection();

    // 이메일 변경 처리
    if (newEmail !== null) {
      // 비밀번호 검증(일반/카카오 모두 가능 요구였지만,
      // 카카오 계정은 비밀번호가 없으므로 프론트에서 currentPassword 입력을 받되
      // DB에 password가 null/빈값이면 검증 생략)
      const [r] = await conn.query(
        'SELECT password FROM users WHERE id = ?',
        [id]
      );
      const hashed = r[0]?.password || null;

      if (hashed) {
        if (!currentPassword) {
          conn.release();
          return res.status(400).json({
            error: '현재 비밀번호를 입력해 주세요.',
            code: 'PW_REQUIRED',
          });
        }
        const ok = await bcrypt.compare(currentPassword, hashed);
        if (!ok) {
          conn.release();
          return res.status(400).json({
            error: '현재 비밀번호가 올바르지 않습니다.',
            code: 'PW_INVALID',
          });
        }
      }
      // 이메일, 검증 초기화, 토큰 발급(이메일 인증용)
      const token = crypto.randomBytes(24).toString('hex');
      const expires = new Date(Date.now() + 1000 * 60 * 30); // 30분
      await conn.query(
        `UPDATE users
         SET email = ?, email_verified = 0, email_verify_token = ?, email_verify_expires = ?
         WHERE id = ?`,
        [newEmail, token, expires, id]
      );

      // TODO: 실제 발송 로직 연결 (SMTP)
      // await sendVerifyEmail(newEmail, token);

      // 나머지 필드 업데이트도 이어서 처리(아래 sets 로)
    }

    // 동적 업데이트
    const sets = [];
    const params = [];
    if (nickname !== null) { sets.push('nickname = ?'); params.push(nickname); }
    if (bio !== null) { sets.push('bio = ?'); params.push(bio); }
    if (avatarUrl) { sets.push('avatar_url = ?'); params.push(avatarUrl); }

    if (sets.length) {
      const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = ?`;
      params.push(id);
      await conn.query(sql, params);
    }

    conn.release();
    return res.json({ message: '프로필 저장 완료' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '프로필 저장 실패' });
  }
};
