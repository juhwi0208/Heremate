// server/routes/auth.js
const express = require('express');
const router = express.Router();

const {
  // Kakao
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
} = require('../controllers/authController');

const { verifyToken, requireAdmin } = require('../middlewares/auth');
const db = require('../db');

/**
 * ---------- 카카오 인가 시작 (프론트에서 직접 호출할 때) ----------
 * GET /auth/kakao/start
 */
router.get('/kakao/start', (req, res) => {
  const clientId = process.env.KAKAO_REST_API_KEY;
  const redirect = encodeURIComponent(process.env.KAKAO_REDIRECT_URI);
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect}&response_type=code`;
  return res.redirect(url);
});

/**
 * Kakao 콜백
 * GET /auth/kakao/callback?code=...
 */
router.get('/kakao/callback', kakaoCallback);

/**
 * 회원가입/이메일 인증
 */
router.get('/check-email', checkEmail);
router.get('/check-nickname', checkNickname); // 컨트롤러에 구현되어 있어야 함
router.post('/signup', signup);
router.get('/verify-email', verifyEmail);
router.post('/resend-verify', resendVerify);

/**
 * 로그인
 */
router.post('/login', login);

/**
 * 비밀번호 재설정 (3단계)
 */
router.post('/reset-password', requestPasswordReset);       // 코드 발송
router.post('/reset-password/verify', verifyResetCode);     // 코드 확인
router.post('/reset-password/confirm', confirmNewPassword); // 새 비번 확정

/**
 * 관리자 예시
 */
router.get('/admin-only', verifyToken, requireAdmin, (req, res) => {
  res.send('관리자 전용 데이터');
});

/**
 * 내 정보
 */
router.get('/me', verifyToken, async (req, res) => {
  const connection = await db.getConnection();
  const [rows] = await connection.query(
    'SELECT email, nickname FROM users WHERE id = ?',
    [req.user.id]
  );
  connection.release();
  res.json(rows[0] || {});
});

router.put('/me', verifyToken, async (req, res) => {
  const { nickname } = req.body;
  const connection = await db.getConnection();
  await connection.query(
    'UPDATE users SET nickname = ? WHERE id = ?',
    [nickname, req.user.id]
  );
  connection.release();
  res.json({ message: '닉네임 수정 완료' });
});

module.exports = router;


