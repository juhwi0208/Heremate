// server/controllers/authController.js
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const KAKAO_REDIRECT_URI =
  process.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/auth/kakao/callback';

const EMAIL_FROM = process.env.EMAIL_FROM || 'HereMate <no-reply@heremate.app>';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

// SMTP 설정
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || 'true') === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
function genCode6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ─────────────────────────────────────────────────────────────
 * Kakao OAuth  (중복 이메일 안전 · 일반계정과 연동)
 * ──────────────────────────────────────────────────────────── */
// GET /auth/kakao/callback?code=...
exports.kakaoCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: '인가 코드가 없습니다.' });

  try {
    // 1) 토큰 교환
    const tokenRes = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_REST_API_KEY,
        redirect_uri: KAKAO_REDIRECT_URI,
        code,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const accessToken = tokenRes.data.access_token;

    // 2) 사용자 정보
    const meRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const kakaoId = String(meRes.data.id);
    const kakaoAcc = meRes.data.kakao_account || {};
    const profile = kakaoAcc.profile || {};
    const emailFromKakao = kakaoAcc.has_email ? kakaoAcc.email : null;
    const isEmailVerified =
      kakaoAcc.is_email_valid === true && kakaoAcc.is_email_verified === true ? 1 : 0;
    const fallbackNick =
      profile.nickname ||
      profile.profile_nickname ||
      (meRes.data.properties && meRes.data.properties.nickname) ||
      `kakao_${kakaoId.slice(-6)}`;

    const conn = await db.getConnection();
    let userRow = null;

    try {
      await conn.beginTransaction();

      // A) kakao_id로 이미 연동된 계정이면 그걸로 로그인
      const [byKakao] = await conn.query(
        'SELECT id, email, nickname, role, kakao_id FROM users WHERE kakao_id = ? LIMIT 1',
        [kakaoId]
      );
      if (byKakao.length) {
        userRow = byKakao[0];

        // 이미 연동된 경우에도, 내 계정의 email이 비어 있고 카카오가 이메일을 제공하며,
        // 그 이메일이 다른 사용자에게 점유되지 않은 경우에만 안전하게 보충 저장
        if (!userRow.email && emailFromKakao) {
          const [dup] = await conn.query(
            'SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1',
            [emailFromKakao, userRow.id]
          );
          if (!dup.length) {
            await conn.query(
              'UPDATE users SET email = ?, email_verified = ? WHERE id = ?',
              [emailFromKakao, isEmailVerified, userRow.id]
            );
            userRow.email = emailFromKakao;
          }
        }
      } else {
        if (emailFromKakao) {
          // B) 이메일이 있으면 이메일로 기존 사용자 검색
          const [byEmail] = await conn.query(
            'SELECT id, email, nickname, role, kakao_id FROM users WHERE email = ? LIMIT 1',
            [emailFromKakao]
          );

          if (byEmail.length) {
            // 기존 일반계정 존재 → kakao_id 연동만(덮어쓰기 금지), provider 업데이트
            const u = byEmail[0];
            if (!u.kakao_id) {
              await conn.query(
                "UPDATE users SET kakao_id = ?, provider = 'kakao', email_verified = 1 WHERE id = ?",
                [kakaoId, u.id]
              );
            }
            userRow = { id: u.id, email: u.email, nickname: u.nickname, role: u.role };
          } else {
            // C) 이메일도 없고 kakao_id도 없으면 신규 생성
            const [ins] = await conn.query(
              "INSERT INTO users (email, nickname, kakao_id, provider, role, email_verified, created_at) VALUES (?, ?, ?, 'kakao', 'user', ?, NOW())",
              [emailFromKakao, fallbackNick, kakaoId, isEmailVerified]
            );
            userRow = { id: ins.insertId, email: emailFromKakao, nickname: fallbackNick, role: 'user' };
          }
        } else {
          // D) 카카오에서 이메일을 주지 않은 경우: kakao_id 기준 신규/연동만
          const [again] = await conn.query(
            'SELECT id, email, nickname, role FROM users WHERE kakao_id = ? LIMIT 1',
            [kakaoId]
          );
          if (again.length) {
            userRow = again[0];
          } else {
            const [ins] = await conn.query(
              "INSERT INTO users (email, nickname, kakao_id, provider, role, email_verified, created_at) VALUES (NULL, ?, ?, 'kakao', 'user', 0, NOW())",
              [fallbackNick, kakaoId]
            );
            userRow = { id: ins.insertId, email: null, nickname: fallbackNick, role: 'user' };
          }
        }
      }

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    // 3) JWT 발급
    const token = signToken(
      { id: userRow.id, nickname: userRow.nickname, role: userRow.role },
      process.env.JWT_EXPIRES_IN || '7d'
    );

    // 프론트가 /auth/me로 동기화하므로 최소 정보만 내려도 OK
    return res.json({ token, user: userRow });
  } catch (e) {
    console.error('kakaoCallback error', e?.response?.data || e);
    return res.status(500).json({ error: '카카오 로그인 실패' });
  }
};

/* ─────────────────────────────────────────────────────────────
 * 회원가입 / 이메일 인증
 * ──────────────────────────────────────────────────────────── */

// GET /auth/check-email?email=...
exports.checkEmail = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: '이메일이 필요합니다.' });

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    return res.json({ exists: rows.length > 0 });
  } catch (e) {
    console.error('checkEmail error:', e);
    return res.status(500).json({ error: '중복 확인 실패' });
  } finally {
    conn.release();
  }
};

// 닉네임 중복 확인
// GET /auth/check-nickname?nickname=...
exports.checkNickname = async (req, res) => {
  const { nickname } = req.query;
  if (!nickname) return res.status(400).json({ error: '닉네임이 필요합니다.' });

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query('SELECT id FROM users WHERE nickname = ?', [nickname]);
    return res.json({ exists: rows.length > 0 });
  } catch (e) {
    console.error('checkNickname error:', e);
    return res.status(500).json({ error: '닉네임 중복 확인 실패' });
  } finally {
    conn.release();
  }
};

// POST /auth/signup  body: { email, password?, nickname, kakaoId? }
exports.signup = async (req, res) => {
  const { email, password, nickname, kakaoId } = req.body;
  if (!email || !nickname || (!password && !kakaoId)) {
    return res
      .status(400)
      .json({ error: '이메일, 닉네임, 비밀번호(또는 카카오ID)가 필요합니다.' });
  }

  const conn = await db.getConnection();
  try {
    // 이메일/닉네임 중복 확인
    const [[eDup]] = await conn.query('SELECT 1 AS x FROM users WHERE email = ?', [email]);
    if (eDup) return res.status(409).json({ error: '이미 존재하는 이메일입니다.', code: 'EMAIL_TAKEN' });

    const [[nDup]] = await conn.query('SELECT 1 AS x FROM users WHERE nickname = ?', [nickname]);
    if (nDup) return res.status(409).json({ error: '이미 존재하는 닉네임입니다.', code: 'NICK_TAKEN' });

    const hashed = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;

    // 이메일 인증 토큰
    const emailToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    const [result] = await conn.query(
      `INSERT INTO users (email, password, nickname, kakao_id, role, email_verified, email_verify_token, email_verify_expires)
       VALUES (?, ?, ?, ?, 'user', 0, ?, ?)`,
      [email, hashed, nickname, kakaoId || null, emailToken, expires]
    );

    const verifyUrl = `${API_BASE_URL}/auth/verify-email?token=${emailToken}`;
    // 인증 메일 발송 (실패해도 회원가입은 진행됨)
    transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: '[HereMate] 이메일 인증을 완료해주세요',
      html: `
        <div>
          <p>${nickname}님, HereMate 가입을 환영합니다!</p>
          <p style="margin:16px 0;">
            <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;">이메일 인증하기</a>
          </p>
          <p>${verifyUrl}</p>
        </div>
      `,
    }).catch((e) => console.error('signup mail send failed:', e));

    const user = { id: result.insertId, nickname, role: 'user' };
    const token = signToken(user, '7d');
    return res.json({ user, token });
  } catch (e) {
    console.error('signup error:', e);
    return res.status(500).json({ error: '회원가입 실패' });
  } finally {
    conn.release();
  }
};

// GET /auth/verify-email?token=...
exports.verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('잘못된 요청입니다.');

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT id, email_verify_expires FROM users WHERE email_verify_token = ?',
      [token]
    );
    if (!rows.length) return res.status(400).send('유효하지 않은 토큰입니다.');
    const row = rows[0];

    if (!row.email_verify_expires || new Date(row.email_verify_expires) < new Date()) {
      return res.status(400).send('토큰이 만료되었습니다.');
    }

    await conn.query(
      `UPDATE users
         SET email_verified = 1, email_verify_token = NULL, email_verify_expires = NULL
       WHERE id = ?`,
      [row.id]
    );

    return res.redirect(`${APP_BASE_URL}/login?verified=1`);
  } catch (e) {
    console.error('verifyEmail error:', e);
    return res.status(500).send('서버 오류');
  } finally {
    conn.release();
  }
};

// POST /auth/resend-verify  body: { email }
exports.resendVerify = async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: '이메일이 필요합니다.' });

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT id, nickname, email_verified FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length) return res.status(404).json({ error: '존재하지 않는 이메일입니다.' });
    if (rows[0].email_verified) return res.status(400).json({ error: '이미 인증된 이메일입니다.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await conn.query(
      'UPDATE users SET email_verify_token = ?, email_verify_expires = ? WHERE id = ?',
      [token, expires, rows[0].id]
    );

    const verifyUrl = `${API_BASE_URL}/auth/verify-email?token=${token}`;
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: '[HereMate] 이메일 인증을 완료해주세요',
      html: `
        <div>
          <p>${rows[0].nickname}님, 이메일 인증을 완료해 주세요.</p>
          <p style="margin:16px 0;">
            <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;">이메일 인증하기</a>
          </p>
          <p>${verifyUrl}</p>
        </div>
      `,
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('resendVerify error:', e);
    return res.status(500).json({ error: '메일 재발송 실패' });
  } finally {
    conn.release();
  }
};

/* ─────────────────────────────────────────────────────────────
 * 로그인
 * ──────────────────────────────────────────────────────────── */
// POST /auth/login  body: { email, password }
exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT id, password, nickname, role, kakao_id, email_verified FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length) return res.status(404).json({ error: '존재하지 않는 사용자입니다.' });

    const user = rows[0];
    if (!user.password) {
      // 소셜 계정은 비밀번호 없음 → 일반 로그인 차단
      return res.status(403).json({
        error: '이 계정은 비밀번호가 없어 일반 로그인할 수 없습니다. (소셜 계정)',
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });

    const token = signToken({ id: user.id, nickname: user.nickname, role: user.role }, '7d');
    return res.json({
      user: {
        id: user.id,
        nickname: user.nickname,
        role: user.role,
        email_verified: !!user.email_verified,
      },
      token,
    });
  } catch (e) {
    console.error('login error:', e);
    return res.status(500).json({ error: '로그인 실패' });
  } finally {
    conn.release();
  }
};

/* ─────────────────────────────────────────────────────────────
 * 비밀번호 재설정 (코드 발송 → 검증 → 새 비번 확정)
 * ──────────────────────────────────────────────────────────── */

// 1단계: 코드 발송
// POST /auth/reset-password   body: { email }
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: '이메일이 필요합니다.' });

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT id, nickname, kakao_id FROM users WHERE email = ?',
      [email]
    );

    if (!rows.length) return res.status(404).json({ error: '해당 이메일의 계정이 없습니다.' });

    // 카카오 계정은 비밀번호 없음 → 차단
    if (rows[0].kakao_id) {
      return res.status(400).json({
        error: '카카오 간편 로그인 계정은 비밀번호가 없습니다. 로그인은 카카오 버튼으로 이용해 주세요.',
        code: 'KAKAO_LINKED',
      });
    }

    const code = genCode6();
    const expires = new Date(Date.now() + 1000 * 60 * 15); // 15분

    await conn.query(
      'UPDATE users SET reset_code = ?, reset_code_expires = ? WHERE id = ?',
      [code, expires, rows[0].id]
    );

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: '[HereMate] 비밀번호 재설정 인증코드',
      html: `
        <div>
          <p>${rows[0].nickname}님, 아래 인증코드를 입력해 주세요 (15분 유효)</p>
          <p style="font-size:20px;font-weight:700;letter-spacing:2px;">${code}</p>
        </div>
      `,
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('requestPasswordReset error:', e);
    return res.status(500).json({ error: '코드 발송 실패' });
  } finally {
    conn.release();
  }
};

// 2단계: 코드 검증
// POST /auth/reset-password/verify   body: { email, code }
exports.verifyResetCode = async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: '이메일과 코드가 필요합니다.' });

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT id, reset_code, reset_code_expires FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length) return res.status(404).json({ error: '존재하지 않는 이메일입니다.' });

    const u = rows[0];
    const valid =
      u.reset_code && u.reset_code === code && u.reset_code_expires && new Date(u.reset_code_expires) > new Date();

    if (!valid) return res.status(400).json({ error: '코드가 올바르지 않거나 만료되었습니다.' });

    return res.json({ ok: true });
  } catch (e) {
    console.error('verifyResetCode error:', e);
    return res.status(500).json({ error: '코드 확인 실패' });
  } finally {
    conn.release();
  }
};

// 3단계: 새 비밀번호 확정
// POST /auth/reset-password/confirm   body: { email, code, newPassword }
exports.confirmNewPassword = async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: '이메일, 코드, 새 비밀번호가 필요합니다.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
  }

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT id, kakao_id, reset_code, reset_code_expires FROM users WHERE email = ?',
      [email]
    );

    if (!rows.length) return res.status(404).json({ error: '계정을 찾을 수 없습니다.' });

    // 카카오 계정은 비밀번호 없음 → 차단
    if (rows[0].kakao_id) {
      return res.status(400).json({
        error: '카카오 간편 로그인 계정은 비밀번호가 없습니다. 로그인은 카카오 버튼으로 이용해 주세요.',
        code: 'KAKAO_LINKED',
      });
    }

    const valid =
      rows[0].reset_code === code &&
      rows[0].reset_code_expires &&
      new Date(rows[0].reset_code_expires) > new Date();

    if (!valid) return res.status(400).json({ error: '코드가 올바르지 않거나 만료되었습니다.' });

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await conn.query(
      `UPDATE users
       SET password = ?, reset_code = NULL, reset_code_expires = NULL
       WHERE id = ?`,
      [hashed, rows[0].id]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error('confirmNewPassword error:', e);
    return res.status(500).json({ error: '비밀번호 변경 실패' });
  } finally {
    conn.release();
  }
};
