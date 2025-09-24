// server/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../db');
const { getKakaoUserInfo } = require('../services/kakaoAuth');
const { findOrCreateUser } = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

// ──────────────────────────────────────────────────────────────
// Mailer (SMTP)
//   .env 예시:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465
//   SMTP_SECURE=true
//   SMTP_USER=heremate.service@gmail.com
//   SMTP_PASS=앱비밀번호16자리
//   EMAIL_FROM="HereMate <no-reply@heremate.app>"
//   APP_BASE_URL=http://localhost:3000
//   API_BASE_URL=http://localhost:4000
// ──────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || 'true') === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
const EMAIL_FROM = process.env.EMAIL_FROM || 'HereMate <no-reply@heremate.app>';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
function genCode6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ──────────────────────────────────────────────────────────────
// Kakao OAuth
// ──────────────────────────────────────────────────────────────
// GET /auth/kakao/start → 카카오 인가 페이지로 리다이렉트
exports.kakaoStart = (req, res) => {
  try {
    const clientId = process.env.KAKAO_REST_API_KEY;
    const redirect = encodeURIComponent(process.env.KAKAO_REDIRECT_URI || `${APP_BASE_URL}/auth/kakao/callback`);
    if (!clientId) return res.status(500).send('KAKAO_REST_API_KEY 누락');
    const url = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect}&response_type=code`;
    return res.redirect(url);
  } catch (e) {
    console.error('kakaoStart error:', e);
    return res.status(500).send('kakaoStart 실패');
  }
};

// GET /auth/kakao/callback?code=...
exports.kakaoCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: '인가코드가 없습니다.' });

  try {
    const kakaoUser = await getKakaoUserInfo(code);
    const user = await findOrCreateUser(kakaoUser);
    const token = signToken({ id: user.id, nickname: user.nickname, role: user.role }, '7d');
    return res.json({ user, token });
  } catch (err) {
    console.error('kakaoCallback error:', err);
    return res.status(500).json({ error: '카카오 로그인 실패' });
  }
};

// ──────────────────────────────────────────────────────────────
/** 회원가입 & 이메일 인증 */
// ──────────────────────────────────────────────────────────────
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

exports.checkNickname = async (req, res) => {
  const { nickname } = req.query;
  if (!nickname) return res.status(400).json({ error: '닉네임이 필요합니다.' });

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query('SELECT id FROM users WHERE nickname = ?', [nickname]);
    return res.json({ exists: rows.length > 0 });
  } catch (e) {
    console.error('checkNickname error:', e);
    return res.status(500).json({ error: '중복 확인 실패' });
  } finally {
    conn.release();
  }
};

// POST /auth/signup
// body: { email, password?, nickname, kakaoId? }
exports.signup = async (req, res) => {
  const { email, password, nickname, kakaoId } = req.body;
  if (!email || !nickname || (!password && !kakaoId)) {
    return res.status(400).json({ error: '이메일, 닉네임, 비밀번호(또는 카카오ID)가 필요합니다.' });
  }

  const conn = await db.getConnection();
  try {
    const [dup] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (dup.length) return res.status(409).json({ error: '이미 존재하는 이메일입니다.' });

    const hashed = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;

    // 이메일 인증 토큰
    const emailToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24시간

    const [result] = await conn.query(
      `INSERT INTO users (email, password, nickname, kakao_id, role, email_verified, email_verify_token, email_verify_expires)
       VALUES (?, ?, ?, ?, 'user', 0, ?, ?)`,
      [email, hashed, nickname, kakaoId || null, emailToken, expires]
    );

    const verifyUrl = `${API_BASE_URL}/auth/verify-email?token=${emailToken}`;
    transporter
      .sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: '[HereMate] 이메일 인증을 완료해주세요',
        html: `
          <div>
            <p>${nickname}님, HereMate 가입을 환영합니다!</p>
            <p style="margin:16px 0;">
              <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;">
                이메일 인증하기
              </a>
            </p>
            <p>${verifyUrl}</p>
          </div>
        `,
      })
      .catch((e) => console.error('signup mail send failed:', e));

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

// POST /auth/resend-verify
// body: { email }
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

// ──────────────────────────────────────────────────────────────
/** 로그인 */
// ──────────────────────────────────────────────────────────────
// POST /auth/login
// body: { email, password }
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
    if (!user.password) return res.status(403).json({ error: '이 계정은 비밀번호가 없어 일반 로그인할 수 없습니다. (소셜 계정)' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });

    const token = signToken({ id: user.id, nickname: user.nickname, role: user.role }, '7d');
    return res.json({
      user: { id: user.id, nickname: user.nickname, role: user.role, email_verified: !!user.email_verified },
      token,
    });
  } catch (e) {
    console.error('login error:', e);
    return res.status(500).json({ error: '로그인 실패' });
  } finally {
    conn.release();
  }
};

// ──────────────────────────────────────────────────────────────
/** 비밀번호 재설정 (코드 방식) */
// ──────────────────────────────────────────────────────────────
// POST /auth/forgot   body: { email }
exports.forgot = async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: '이메일이 필요합니다.' });

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query('SELECT id, nickname FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(404).json({ error: '존재하지 않는 이메일입니다.' });

    const code = genCode6();
    const expires = new Date(Date.now() + 1000 * 60 * 10); // 10분

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
          <p>${rows[0].nickname}님, 아래 인증코드를 입력해 주세요 (10분 유효)</p>
          <p style="font-size:20px;font-weight:700;letter-spacing:2px;">${code}</p>
        </div>
      `,
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('forgot error:', e);
    return res.status(500).json({ error: '코드 발송 실패' });
  } finally {
    conn.release();
  }
};

// POST /auth/verify-reset   body: { email, code }
exports.verifyReset = async (req, res) => {
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
    const valid = u.reset_code && u.reset_code === code && u.reset_code_expires && new Date(u.reset_code_expires) > new Date();
    if (!valid) return res.status(400).json({ error: '코드가 올바르지 않거나 만료되었습니다.' });

    return res.json({ ok: true });
  } catch (e) {
    console.error('verifyReset error:', e);
    return res.status(500).json({ error: '코드 확인 실패' });
  } finally {
    conn.release();
  }
};

// POST /auth/update-password   body: { email, code, newPassword }
exports.updatePassword = async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: '이메일, 코드, 새 비밀번호가 필요합니다.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
  }

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT id, reset_code, reset_code_expires FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length) return res.status(404).json({ error: '존재하지 않는 이메일입니다.' });

    const u = rows[0];
    const valid = u.reset_code && u.reset_code === code && u.reset_code_expires && new Date(u.reset_code_expires) > new Date();
    if (!valid) return res.status(400).json({ error: '코드가 올바르지 않거나 만료되었습니다.' });

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await conn.query(
      'UPDATE users SET password = ?, reset_code = NULL, reset_code_expires = NULL WHERE id = ?',
      [hashed, u.id]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error('updatePassword error:', e);
    return res.status(500).json({ error: '비밀번호 변경 실패' });
  } finally {
    conn.release();
  }
};

// ──────────────────────────────────────────────────────────────
/** (구방식) 임시 비밀번호 발급 — 구 프론트 호환용 */
// ──────────────────────────────────────────────────────────────
// POST /auth/reset-password   body: { email }
//  - 현재 ForgotPassword 화면이 이 엔드포인트를 직접 호출하는 코드가 남아 있을 수 있음
exports.resetPassword = async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: '이메일이 필요합니다.' });

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query('SELECT id, nickname FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(404).json({ error: '존재하지 않는 이메일입니다.' });

    const tempPassword = crypto.randomBytes(4).toString('hex'); // 8자리
    const hashed = await bcrypt.hash(tempPassword, 10);
    await conn.query('UPDATE users SET password = ? WHERE email = ?', [hashed, email]);

    // 메일 발송 (선택)
    transporter
      .sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: '[HereMate] 임시 비밀번호 안내',
        html: `
          <div>
            <p>${rows[0].nickname}님, 아래 임시 비밀번호로 로그인 후 반드시 변경해 주세요.</p>
            <p style="font-size:18px;font-weight:bold;margin:12px 0;">${tempPassword}</p>
          </div>
        `,
      })
      .catch((e) => console.error('resetPassword mail send failed:', e));

    // 데모 호환: 프론트에 직접 전달
    return res.json({ tempPassword });
  } catch (e) {
    console.error('resetPassword error:', e);
    return res.status(500).json({ error: '비밀번호 재설정 실패' });
  } finally {
    conn.release();
  }
};
