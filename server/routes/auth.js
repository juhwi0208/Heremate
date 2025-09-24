// server/routes/auth.js
const express = require('express');
const router = express.Router();
const {
  kakaoStart,
  kakaoCallback,
  signup,
  checkEmail,
  checkNickname,
  login,
  verifyEmail,
  resendVerify,
  forgot,
  verifyReset,
  updatePassword,
  
} = require('../controllers/authController');
const { verifyToken, requireAdmin } = require('../middlewares/auth');
const db = require('../db');

// 카카오
router.get('/kakao/start', kakaoStart);
router.get('/kakao/callback', kakaoCallback);

// 회원가입/인증
router.get('/check-email', checkEmail);
router.get('/check-nickname', checkNickname);
router.post('/signup', signup);
router.get('/verify-email', verifyEmail);
router.post('/resend-verify', resendVerify);

// 로그인
router.post('/login', login);

// 비밀번호 찾기(코드) & 변경
router.post('/forgot', forgot);            // 이메일로 코드 발송
router.post('/verify-reset', verifyReset); // 코드 확인
router.post('/update-password', updatePassword); // 새 비번 저장

// 예시: 관리자만
router.get('/admin-only', verifyToken, requireAdmin, (req, res) => {
  res.send('관리자 전용 데이터');
});

// 내 정보 (간단 예시)
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

