// server/routes/auth.js
const express = require('express');
const router = express.Router();
const { resetPassword } = require('../controllers/authController');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

const db = require('../db');

const {
  kakaoCallback,
  signup,
  checkEmail,
  login
} = require('../controllers/authController');

router.get('/kakao/callback', kakaoCallback);
router.post('/signup', signup);
router.post('/login', login);
router.get('/check-email', checkEmail);
router.post('/reset-password', resetPassword);
router.get('/admin-only', verifyToken, requireAdmin, (req, res) => {
  res.send('관리자 전용 데이터');
});

router.get('/me', verifyToken, async (req, res) => {
  const connection = await db.getConnection();
  const [rows] = await connection.query('SELECT email, nickname FROM users WHERE id = ?', [req.user.id]);
  connection.release();
  res.json(rows[0]);
});

router.put('/me', verifyToken, async (req, res) => {
  const { nickname } = req.body;
  const connection = await db.getConnection();
  await connection.query('UPDATE users SET nickname = ? WHERE id = ?', [nickname, req.user.id]);
  connection.release();
  res.json({ message: '닉네임 수정 완료' });
});
module.exports = router;
