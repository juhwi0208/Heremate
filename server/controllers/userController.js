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
       `SELECT id, email, nickname, role,
               created_at AS created_at,
               avatar_url, bio,
               kakao_id, email_verified,
               CASE WHEN password IS NULL OR password = '' THEN 0 ELSE 1 END AS has_password
        FROM users
        WHERE id = ?`,
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
      has_password: u.has_password,
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

/**
 * DELETE /api/users/me
 * - 일반계정: currentPassword 필요
 * - 카카오전용: confirm=true 필요
 * - 실제 삭제 대신 '익명화' 업데이트로 처리 (FK 보호)
 */
exports.deleteMe = async (req, res) => {
  const id = req.user.id;
  const { currentPassword, confirm } = req.body || {};

  const conn = await db.getConnection();
  try {
    const [[u]] = await conn.query(
      'SELECT id, email, password, kakao_id FROM users WHERE id = ?',
      [id]
    );
    if (!u) { conn.release(); return res.status(404).json({ error: '사용자 없음' }); }

    // 비밀번호 존재 → 반드시 확인
    if (u.password) {
      if (!currentPassword) {
        conn.release();
        return res.status(400).json({ error: '현재 비밀번호를 입력해 주세요.' });
      }
      const ok = await bcrypt.compare(currentPassword, u.password);
      if (!ok) {
        conn.release();
        return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
      }
    } else {
      // 소셜 전용이면 한 번 더 확인만 요구
      if (!confirm) {
        conn.release();
        return res.status(400).json({ error: '탈퇴 확인이 필요합니다.', code: 'CONFIRM_REQUIRED' });
      }
    }

    // 익명화(소프트 삭제 유사)
    const anonEmail = `deleted+${u.id}@example.invalid`;
    const anonNick = `탈퇴회원${u.id}`;
    await conn.query(
      `UPDATE users SET
          email = ?,
          password = NULL,
          nickname = ?,
          bio = '',
          avatar_url = NULL,
          kakao_id = NULL,
          email_verified = 0,
          email_verify_token = NULL,
          email_verify_expires = NULL,
          reset_code = NULL,
          reset_code_expires = NULL
        WHERE id = ?`,
      [anonEmail, anonNick, u.id]
    );

    conn.release();
    return res.json({ ok: true });
  } catch (e) {
    conn.release();
    console.error(e);
    return res.status(500).json({ error: '회원탈퇴 처리 실패' });
  }
};