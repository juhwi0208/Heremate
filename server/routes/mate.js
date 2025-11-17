// server/routes/mate.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const { searchMates } = require('../controllers/mateController');

// 내가 쓴 글 필터(me=1) 포함, 검색 전용
// 예: GET /api/mates?location=제주&style=자연&me=1
router.get('/', verifyToken, searchMates);

module.exports = router;