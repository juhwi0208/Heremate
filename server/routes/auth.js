// server/routes/auth.js
const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middlewares/auth');
const db = require('../db');

const {
  kakaoCallback,

  // 이메일/회원가입/로그인
  signup,
  checkEmail,
  checkNickname,
  login,
  verifyEmail,
  resendVerify,

  // 비밀번호 재설정(3단계)
  requestPasswordReset,
  verifyResetCode,
  confirmNewPassword,

  // 가입용 코드
  requestSignupCode,
  verifySignupCode,
} = require('../controllers/authController');

// ---------- 카카오 인가 시작 (login / link 공용) ----------
router.get('/kakao/start', (req, res) => {
  const clientId = process.env.KAKAO_REST_API_KEY;
  const redirect = encodeURIComponent(process.env.KAKAO_REDIRECT_URI);
  const scope = encodeURIComponent(process.env.KAKAO_SCOPE || 'account_email');
  const mode = (req.query.mode === 'link') ? 'link' : 'login';
  const token = req.query.token || '';
  const stateObj = { mode, token };
  const state = encodeURIComponent(Buffer.from(JSON.stringify(stateObj)).toString('base64'));

  // 🔴 핵심: 링크 모드에서는 prompt=login 으로 SSO 자동승인 방지(계정 선택/로그인 화면 강제)
  const prompt = mode === 'link' ? 'login' : 'consent';

  const url =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirect}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&prompt=${prompt}` +
    `&state=${state}`;

  return res.redirect(url);
});

// Kakao 콜백
router.get('/kakao/callback', kakaoCallback);

/**
 * 회원가입/이메일 인증
 */
router.get('/check-email', checkEmail);
router.get('/check-nickname', checkNickname);
router.post('/signup/request-code', requestSignupCode);
router.post('/signup/verify-code', verifySignupCode);
router.post('/signup', signup);
router.get('/verify-email', verifyEmail);
router.post('/resend-verify', resendVerify);

/**
 * 로그인
 */
router.post('/login', login);

/**
 * 비밀번호 찾기/변경 3단계
 */
const account = require('../controllers/accountController');
router.post('/password/request-code', account.requestPasswordCode);
router.post('/password/verify-code', account.verifyPasswordCode);
router.post('/password/update', account.updatePasswordByCode);

/**
 * 이메일 변경 2단계
 */
router.post('/email/request-code', verifyToken, account.requestEmailChangeCode);
router.post('/email/confirm', verifyToken, account.confirmEmailChange);

/**
 * 관리자 예시
 */
router.get('/admin-only', verifyToken, requireAdmin, (req, res) => {
  res.send('관리자 전용 데이터');
});

/**
 * 내 정보 (예시)
 */
router.get('/me', verifyToken, async (req, res) => {
  const connection = await db.getConnection();
  const [rows] = await connection.query('SELECT email, nickname FROM users WHERE id = ?', [req.user.id]);
  connection.release();
  res.json(rows[0] || {});
});

router.put('/me', verifyToken, async (req, res) => {
  const { nickname } = req.body;
  const connection = await db.getConnection();
  await connection.query('UPDATE users SET nickname = ? WHERE id = ?', [nickname, req.user.id]);
  connection.release();
  res.json({ message: '닉네임 수정 완료' });
});

module.exports = router;
