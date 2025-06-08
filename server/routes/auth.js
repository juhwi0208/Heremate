const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const router = express.Router();
const db = require('../db/db'); 

// 회원가입
router.post('/signup', async (req, res) => {
  let { email, password, nickname, kakaoId } = req.body;

  // 이메일과 닉네임 기본값 처리
  email = email || '';
  nickname = nickname || '카카오사용자';

  try {
    if (!kakaoId) {
      // 일반 회원가입 - 비밀번호 필수
      if (!password) {
        return res.status(400).json({ message: '비밀번호가 필요합니다.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const sql = 'INSERT INTO users (email, password, nickname) VALUES (?, ?, ?)';
      db.query(sql, [email, hashedPassword, nickname], (err, result) => {
        if (err) return res.status(500).json({ message: '회원가입 실패', error: err });
        res.status(201).json({ message: '회원가입 성공' });
      });
    } else {
      // 카카오 회원가입 - 비밀번호 없이 처리
      const insertSql = 'INSERT INTO users (kakao_id, email, nickname) VALUES (?, ?, ?)';
      db.query(insertSql, [kakaoId, email, nickname], (err, result) => {
        if (err) return res.status(500).json({ message: '회원가입 실패', error: err });
        res.status(201).json({ message: '회원가입 성공' });
      });
    }
  } catch (err) {
    res.status(500).json({ message: '서버 오류', error: err.message });
  }
});

// 카카오 로그인
router.post('/auth/kakao', async (req, res) => {
  const { code } = req.body;
  const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
  const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;

  try {
    // 1) 토큰 요청
    const tokenRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: REST_API_KEY,
        redirect_uri: REDIRECT_URI,
        code,
      },
      headers: { 'Content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
    });
    const accessToken = tokenRes.data.access_token;

    // 2) 사용자 정보 요청
    const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const kakaoId = userRes.data.id;
    const email = userRes.data.kakao_account?.email || null;
    const nickname = userRes.data.kakao_account?.profile?.nickname || '카카오사용자';

    // 3) DB 확인
    const checkSql = 'SELECT * FROM users WHERE kakao_id = ?';
    db.query(checkSql, [kakaoId], (err, results) => {
      if (err) return res.status(500).json({ message: 'DB 오류', error: err });

      if (results.length > 0) {
        // 기존 사용자
        const user = results[0];
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '2h' });
        return res.json({ token, user });
      } else {
        // 신규 사용자 → 프론트로 가입 유도 정보 전달
        return res.status(200).json({ newUser: true, kakaoId, email, nickname });
      }
    });
  } catch (err) {
    console.error('카카오 로그인 실패:', err.response?.data || err.message);
    res.status(500).json({ message: '카카오 로그인 실패', error: err.message });
  }
});

module.exports = router;


