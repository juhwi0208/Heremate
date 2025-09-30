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

// 🟢 카카오-only 사용자를 위한 비밀번호 최초 생성
// POST /auth/password/set  (JWT 필요)  body: { newPassword }
exports.setInitialPassword = async (req, res) => {
  const userId = req.user?.id;
  const { newPassword } = req.body || {};
  if (!userId) return res.status(401).json({ error: '인증이 필요합니다.' });
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
  }

  const conn = await db.getConnection();
  try {
    const [[u]] = await conn.query(
      'SELECT id, password FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!u) { conn.release(); return res.status(404).json({ error: '사용자가 없습니다.' }); }
    if (u.password) { conn.release(); return res.status(400).json({ error: '이미 비밀번호가 설정된 계정입니다.' }); }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await conn.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
    conn.release();
    return res.json({ ok: true });
  } catch (e) {
    try { conn.release(); } catch {}
    console.error('setInitialPassword error:', e);
    return res.status(500).json({ error: '비밀번호 설정 실패' });
  }
};
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

/* ------------------------------------------------------------------
 * 가입용 이메일 코드 (Map 메모리 저장)
 *  - 서버 재시작 시 초기화됨(프로덕션이면 Redis/DB 권장)
 * ------------------------------------------------------------------ */
const signupCodes = new Map(); // key=email, val={ code, expiresAt, verified:bool }

/* ─────────────────────────────────────────────────────────────
 * Kakao OAuth  (로그인 모드 vs 연동 링크 모드)
 * - state 에 { mode: 'login'|'link', token?:jwt } 적재
 * - 'login' 모드:
 *    · 이메일이 "비번있는 일반계정"에 이미 존재 → 자동병합 금지, 에러 반환(NEEDS_LINKING)
 * - 'link' 모드:
 *    · state.token 검증 → 해당 사용자에게 kakao_id 귀속
 *    · 충돌/소유권 이슈는 에러 코드로 안내
 * ──────────────────────────────────────────────────────────── */
exports.kakaoCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ error: '인가 코드가 없습니다.' });

  // state 파싱
  let mode = 'login';
  let linkUserId = null;
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      if (decoded?.mode === 'link') mode = 'link';
      if (decoded?.token) {
        const v = jwt.verify(decoded.token, JWT_SECRET);
        linkUserId = v?.id || null;
      }
    } catch {}
  }

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
    const acc = meRes.data.kakao_account || {};
    const profile = acc.profile || {};
    const emailFromKakao = acc.has_email ? acc.email : null;
    const isEmailVerified = acc.is_email_valid === true && acc.is_email_verified === true ? 1 : 0;
    const fallbackNick =
      profile.nickname ||
      profile.profile_nickname ||
      (meRes.data.properties && meRes.data.properties.nickname) ||
      `kakao_${kakaoId.slice(-6)}`;

    const conn = await db.getConnection();
    let userRow = null;

    try {
      await conn.beginTransaction();

      // 잠금 조회
      const [curOwnerRows] = await conn.query(
        'SELECT id, email, nickname, role, kakao_id, provider FROM users WHERE kakao_id = ? LIMIT 1 FOR UPDATE',
        [kakaoId]
      );

      // 이메일 소유자
      let emailOwnerRow = null;
      if (emailFromKakao) {
        const [byEmailRows] = await conn.query(
          'SELECT id, email, nickname, role, kakao_id, provider, password FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
          [emailFromKakao]
        );
        if (byEmailRows.length) emailOwnerRow = byEmailRows[0];
      }

      // === 링크 모드: 현재 로그인 사용자에게 kakao_id 부착 ===
      if (mode === 'link') {
        if (!linkUserId) throw new Error('LINK_MODE_INVALID');

        // 이미 다른 계정이 이 kakao_id를 쓰고 있으면 거부
        if (curOwnerRows.length && curOwnerRows[0].id !== linkUserId) {
          throw Object.assign(new Error('already linked'), {
            status: 409,
            payload: { error: '이미 다른 계정에 연동된 카카오입니다.', code: 'KAKAO_ALREADY_LINKED' },
          });
        }

        // 이메일 충돌: 카카오가 준 이메일이 "다른 사람"의 이메일이면 거부(병합 금지)
        if (emailFromKakao && emailOwnerRow && emailOwnerRow.id !== linkUserId) {
          throw Object.assign(new Error('email owned by someone else'), {
            status: 409,
            payload: { error: '이 카카오 이메일은 다른 계정에 사용 중입니다.', code: 'EMAIL_OWNED_BY_OTHER' },
          });
        }

        // 소유자(=현재 로그인 사용자)에게 부여
        await conn.query('UPDATE users SET kakao_id = ?, provider = "kakao", email_verified = GREATEST(email_verified, ?) WHERE id = ?',
          [kakaoId, isEmailVerified, linkUserId]);

        // 카카오가 이메일을 주고, 내 계정 이메일이 비어있으면 보충
        if (emailFromKakao) {
          await conn.query(
            'UPDATE users SET email = IFNULL(email, ?), email_verified = GREATEST(email_verified, ?) WHERE id = ?',
            [emailFromKakao, isEmailVerified, linkUserId]
          );
        }

        const [meRows] = await conn.query('SELECT id, email, nickname, role, kakao_id FROM users WHERE id = ?', [linkUserId]);
        userRow = meRows[0];
        await conn.commit();

        const token = signToken({ id: userRow.id, nickname: userRow.nickname, role: userRow.role }, process.env.JWT_EXPIRES_IN || '7d');
        return res.json({ token, user: userRow, linked: true });
      }

      // === 로그인 모드 ===
      if (curOwnerRows.length) {
        // A) 이미 kakao_id 소유자가 있으면 그 계정으로 로그인
        userRow = curOwnerRows[0];
        if (!userRow.email && emailFromKakao) {
          if (!emailOwnerRow || emailOwnerRow.id === userRow.id) {
            await conn.query(
              'UPDATE users SET email = ?, email_verified = GREATEST(email_verified, ?) WHERE id = ?',
              [emailFromKakao, isEmailVerified, userRow.id]
            );
            userRow.email = emailFromKakao;
          }
        }
      } else {
        // B) kakao_id 소유자가 없음
        if (emailFromKakao && emailOwnerRow) {
          // ✳︎ 요구사항: 일반계정 이메일이면 자동 병합 금지 → 안내 반환
          const hasPassword = !!emailOwnerRow.password;
          if (hasPassword && !emailOwnerRow.kakao_id) {
            // 일반 로그인 후 마이페이지에서 연동하도록 유도
            await conn.rollback();
            return res.status(409).json({
              error: '일반 로그인 계정입니다. 일반 로그인 후 카카오 연동을 진행해 주세요.',
              code: 'NEEDS_LINKING',
              email: emailFromKakao,
            });
          }

          // (이미 연동된 케이스면 그 계정으로 로그인)
          if (emailOwnerRow.kakao_id === kakaoId) {
            userRow = {
              id: emailOwnerRow.id,
              email: emailOwnerRow.email,
              nickname: emailOwnerRow.nickname,
              role: emailOwnerRow.role,
              kakao_id: kakaoId,
            };
          } else if (!emailOwnerRow.kakao_id) {
            // 혹시 병합 허용 시나리오(드물게 비번 없는 소셜만 계정) → 연동
            await conn.query(
              "UPDATE users SET kakao_id = ?, provider = 'kakao', email_verified = GREATEST(email_verified, ?) WHERE id = ?",
              [kakaoId, isEmailVerified, emailOwnerRow.id]
            );
            userRow = {
              id: emailOwnerRow.id,
              email: emailOwnerRow.email,
              nickname: emailOwnerRow.nickname,
              role: emailOwnerRow.role,
              kakao_id: kakaoId,
            };
          }
        } else if (emailFromKakao && !emailOwnerRow) {
          // 신규 생성
          const [ins] = await conn.query(
            "INSERT INTO users (email, nickname, kakao_id, provider, role, email_verified, created_at) VALUES (?, ?, ?, 'kakao', 'user', ?, NOW())",
            [emailFromKakao, fallbackNick, kakaoId, isEmailVerified]
          );
          userRow = { id: ins.insertId, email: emailFromKakao, nickname: fallbackNick, role: 'user', kakao_id: kakaoId };
        } else {
          // 이메일이 없을 때
          const [again] = await conn.query('SELECT id, email, nickname, role FROM users WHERE kakao_id = ? LIMIT 1', [kakaoId]);
          if (again.length) {
            userRow = again[0];
          } else {
            const [ins] = await conn.query(
              "INSERT INTO users (email, nickname, kakao_id, provider, role, email_verified, created_at) VALUES (NULL, ?, ?, 'kakao', 'user', 0, NOW())",
              [fallbackNick, kakaoId]
            );
            userRow = { id: ins.insertId, email: null, nickname: fallbackNick, role: 'user', kakao_id: kakaoId };
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

    // JWT 발급
    const token = signToken(
      { id: userRow.id, nickname: userRow.nickname, role: userRow.role },
      process.env.JWT_EXPIRES_IN || '7d'
    );

    return res.json({ token, user: userRow });
  } catch (e) {
    if (e.status && e.payload) {
      return res.status(e.status).json(e.payload);
    }
    console.error('kakaoCallback error', e?.response?.data || e);
    return res.status(500).json({ error: '카카오 로그인 실패' });
  }
};


/* ─────────────────────────────────────────────────────────────
 * 회원가입 / 이메일 인증(중복확인 + 코드인증)
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

// POST /auth/signup/request-code  body: { email }
exports.requestSignupCode = async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: '이메일이 필요합니다.' });

  const conn = await db.getConnection();
  try {
    const [[dup]] = await conn.query('SELECT 1 AS x FROM users WHERE email = ?', [email]);
    if (dup) return res.status(409).json({ error: '이미 존재하는 이메일입니다.', code: 'EMAIL_TAKEN' });

    const code = genCode6();
    const expiresAt = Date.now() + 1000 * 60 * 10; // 10분
    signupCodes.set(email, { code, expiresAt, verified: false });

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: '[HereMate] 회원가입 인증 코드',
      html: `<p>회원가입 인증코드: <b style="font-size:18px;letter-spacing:3px">${code}</b> (10분 유효)</p>`,
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('requestSignupCode error:', e);
    return res.status(500).json({ error: '코드 발송 실패' });
  } finally {
    conn.release();
  }
};

// POST /auth/signup/verify-code  body: { email, code }
exports.verifySignupCode = async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: '이메일과 코드가 필요합니다.' });

  const saved = signupCodes.get(email);
  if (!saved) return res.status(400).json({ error: '코드 요청 내역이 없습니다.' });
  if (Date.now() > saved.expiresAt) return res.status(400).json({ error: '코드 유효시간이 지났습니다.' });
  if (String(code) !== String(saved.code)) return res.status(400).json({ error: '인증 코드가 올바르지 않습니다.' });

  saved.verified = true;
  return res.json({ ok: true });
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
    const [[eDup]] = await conn.query('SELECT 1 AS x FROM users WHERE email = ?', [email]);
    if (eDup) return res.status(409).json({ error: '이미 존재하는 이메일입니다.', code: 'EMAIL_TAKEN' });

    const [[nDup]] = await conn.query('SELECT 1 AS x FROM users WHERE nickname = ?', [nickname]);
    if (nDup) return res.status(409).json({ error: '이미 존재하는 닉네임입니다.', code: 'NICK_TAKEN' });

    const hashed = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;

    // 가입 코드 검증 여부 확인
    const sc = signupCodes.get(email);
    const emailVerifiedNow = sc && sc.verified === true;

    const emailToken = emailVerifiedNow ? null : crypto.randomBytes(32).toString('hex');
    const expires = emailVerifiedNow ? null : new Date(Date.now() + 1000 * 60 * 60 * 24);

    const [result] = await conn.query(
      `INSERT INTO users (email, password, nickname, kakao_id, role, email_verified, email_verify_token, email_verify_expires)
       VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`,
      [email, hashed, nickname, kakaoId || null, emailVerifiedNow ? 1 : 0, emailToken, expires]
    );

    // 코드 소모
    if (sc) signupCodes.delete(email);

    // 링크 인증이 필요한 경우에만 발송
    if (!emailVerifiedNow) {
      const verifyUrl = `${API_BASE_URL}/auth/verify-email?token=${emailToken}`;
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
    }

    const user = { id: result.insertId, nickname, role: 'user' };
    const token = signToken(user, '7d');
    return res.json({ user, token, email_verified: emailVerifiedNow });
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

/* ─────────────────────────────────────────────────────────────
 * 로그인
 * ──────────────────────────────────────────────────────────── */
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

// ─────────────────────────────────────────────────────────────
// 이메일 인증 메일 재전송
// POST /auth/resend-verify   body: { email }
// ─────────────────────────────────────────────────────────────
exports.resendVerify = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: '이메일이 필요합니다.' });

    const conn = await db.getConnection();
    try {
      const [rows] = await conn.query(
        'SELECT id, nickname, email_verified FROM users WHERE email = ? LIMIT 1',
        [email]
      );
      if (!rows.length) {
        conn.release();
        return res.status(404).json({ error: '해당 이메일의 사용자가 없습니다.' });
      }

      const u = rows[0];
      if (u.email_verified) {
        conn.release();
        return res.status(200).json({ ok: true, message: '이미 이메일 인증이 완료된 계정입니다.' });
      }

      // 새 토큰 발급
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

      await conn.query(
        'UPDATE users SET email_verify_token = ?, email_verify_expires = ? WHERE id = ?',
        [token, expires, u.id]
      );
      conn.release();

      const verifyUrl = `${process.env.API_BASE_URL || 'http://localhost:4000'}/auth/verify-email?token=${token}`;

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'HereMate <no-reply@heremate.app>',
        to: email,
        subject: '[HereMate] 이메일 인증을 완료해주세요',
        html: `
          <div>
            <p>${u.nickname || '회원'}님, 이메일 인증을 완료해 주세요.</p>
            <p style="margin:16px 0;">
              <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;">이메일 인증하기</a>
            </p>
            <p>${verifyUrl}</p>
          </div>
        `,
      });

      return res.json({ ok: true, message: '인증 메일을 다시 보냈습니다.' });
    } catch (e) {
      try { conn.release(); } catch {}
      throw e;
    }
  } catch (e) {
    console.error('resendVerify error:', e);
    return res.status(500).json({ error: '인증 메일 재전송 실패' });
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
