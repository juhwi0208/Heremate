// server/routes/auth.js
const express = require('express');
const router = express.Router();
const { resetPassword } = require('../controllers/authController');

const {
  kakaoCallback,
  signup,
  checkEmail,
} = require('../controllers/authController');

router.get('/kakao/callback', kakaoCallback);
router.post('/signup', signup);
router.post('/login', login);
router.get('/check-email', checkEmail);
router.post('/reset-password', resetPassword);
module.exports = router;
