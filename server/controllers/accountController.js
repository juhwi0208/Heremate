// server/controllers/accountController.js
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const db = require('../db');

const codes = new Map(); // key => { code, expiresAt }

function mailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function isKakaoCreatedByEmail(email) { // 🟢 Added
  const conn = await db.getConnection();
  const [[u]] = await conn.query('SELECT password FROM users WHERE email = ?', [email]);
  conn.release();
  if (!u) return false;
  return !u.password || u.password === ''; // password 없으면 카카오 생성 계정으로 간주
}

async function isKakaoCreatedById(userId) { // 🟢 Added
  const conn = await db.getConnection();
  const [[u]] = await conn.query('SELECT password FROM users WHERE id = ?', [userId]);
  conn.release();
  if (!u) return false;
  return !u.password || u.password === '';
}

// ==================== 비밀번호 찾기/변경 ====================

// 1) 코드 발송
exports.requestPasswordCode = async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: '이메일이 필요합니다.' });

  try {
    // 카카오 생성 계정 차단
    if (await isKakaoCreatedByEmail(email)) { // 🟢 Added
      return res.status(400).json({ error: '카카오 로그인으로 생성된 계정은 비밀번호 기능을 사용할 수 없습니다.' });
    }

    const conn = await db.getConnection();
    const [rows] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    conn.release();
    if (!rows.length) return res.status(404).json({ error: '가입된 이메일이 아닙니다.' });

    const code = '' + Math.floor(100000 + Math.random() * 900000);
    const expiresAt = Date.now() + 1000 * 60 * 10; // 10분
    codes.set(email, { code, expiresAt });

    await mailer().sendMail({
      from: process.env.EMAIL_FROM || 'HereMate <no-reply@heremate.app>',
      to: email,
      subject: '[HereMate] 비밀번호 변경 인증 코드',
      text: `인증 코드: ${code} (10분 내 유효)`,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '코드 발송 실패' });
  }
};

// 2) 코드 검증
exports.verifyPasswordCode = async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: '이메일과 코드가 필요합니다.' });

  // 카카오 생성 계정 차단
  if (await isKakaoCreatedByEmail(email)) { // 🟢 Added
    return res.status(400).json({ error: '카카오 로그인으로 생성된 계정은 비밀번호 기능을 사용할 수 없습니다.' });
  }

  const saved = codes.get(email);
  if (!saved) return res.status(400).json({ error: '코드 요청 내역이 없습니다.' });
  if (Date.now() > saved.expiresAt) return res.status(400).json({ error: '코드 유효시간이 지났습니다.' });
  if (String(code) !== String(saved.code)) return res.status(400).json({ error: '인증 코드가 올바르지 않습니다.' });
  res.json({ ok: true });
};

// 3) 비밀번호 업데이트
exports.updatePasswordByCode = async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) return res.status(400).json({ error: '이메일/코드/새 비밀번호가 필요합니다.' });

  // 카카오 생성 계정 차단
  if (await isKakaoCreatedByEmail(email)) { // 🟢 Added
    return res.status(400).json({ error: '카카오 로그인으로 생성된 계정은 비밀번호 기능을 사용할 수 없습니다.' });
  }

  const saved = codes.get(email);
  if (!saved) return res.status(400).json({ error: '코드 요청 내역이 없습니다.' });
  if (Date.now() > saved.expiresAt) return res.status(400).json({ error: '코드 유효시간이 지났습니다.' });
  if (String(code) !== String(saved.code)) return res.status(400).json({ error: '인증 코드가 올바르지 않습니다.' });
  if (newPassword.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });

  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    const conn = await db.getConnection();
    await conn.query('UPDATE users SET password = ? WHERE email = ?', [hashed, email]);
    conn.release();
    codes.delete(email);
    res.json({ ok: true, message: '비밀번호가 변경되었습니다.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '비밀번호 변경 실패' });
  }
};

// ==================== 이메일 변경 ====================

// 1) 새 이메일 코드 요청(현재 비번 확인 포함)
exports.requestEmailChangeCode = async (req, res) => {
  const userId = req.user?.id;
  const { password, newEmail } = req.body || {};
  if (!password || !newEmail) return res.status(400).json({ error: '비밀번호와 새 이메일이 필요합니다.' });

  try {
    if (await isKakaoCreatedById(userId)) { // 🟢 Added: 카카오 생성 계정 차단
      return res.status(400).json({ error: '카카오 로그인으로 생성된 계정은 이메일을 변경할 수 없습니다.' });
    }

    const conn = await db.getConnection();
    const [[me]] = await conn.query('SELECT id, password FROM users WHERE id = ?', [userId]);
    if (!me) { conn.release(); return res.status(404).json({ error: '사용자 없음' }); }

    const ok = await bcrypt.compare(password, me.password || '');
    if (!ok) { conn.release(); return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' }); }

    const [[dup]] = await conn.query('SELECT id FROM users WHERE email = ?', [newEmail]);
    conn.release();
    if (dup) return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });

    const code = '' + Math.floor(100000 + Math.random() * 900000);
    const expiresAt = Date.now() + 1000 * 60 * 10;
    codes.set(`${userId}:${newEmail}`, { code, expiresAt });

    await mailer().sendMail({
      from: process.env.EMAIL_FROM || 'HereMate <no-reply@heremate.app>',
      to: newEmail,
      subject: '[HereMate] 이메일 변경 인증 코드',
      text: `인증 코드: ${code} (10분 내 유효)`,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '요청 처리 실패' });
  }
};

// 2) 코드 확인 후 실제 이메일 변경
exports.confirmEmailChange = async (req, res) => {
  const userId = req.user?.id;
  const { newEmail, code } = req.body || {};
  if (!newEmail || !code) return res.status(400).json({ error: '새 이메일과 인증 코드가 필요합니다.' });

  if (await isKakaoCreatedById(userId)) { // 🟢 Added
    return res.status(400).json({ error: '카카오 로그인으로 생성된 계정은 이메일을 변경할 수 없습니다.' });
  }

  const key = `${userId}:${newEmail}`;
  const saved = codes.get(key);
  if (!saved) return res.status(400).json({ error: '코드 요청 내역이 없습니다.' });
  if (Date.now() > saved.expiresAt) return res.status(400).json({ error: '코드 유효시간이 지났습니다.' });
  if (String(code) !== String(saved.code)) return res.status(400).json({ error: '인증 코드가 올바르지 않습니다.' });

  try {
    const conn = await db.getConnection();
    await conn.query('UPDATE users SET email = ? WHERE id = ?', [newEmail, userId]);
    conn.release();
    codes.delete(key);
    res.json({ ok: true, message: '이메일이 변경되었습니다.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '이메일 변경 실패' });
  }
};
