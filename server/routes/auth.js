const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const router = express.Router();

const db = require('../db'); // DB 연결 파일을 따로 관리한다면 여기 경로 수정

// 회원가입
router.post('/signup', async (req, res) => {
  const { email, password, nickname } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = 'INSERT INTO users (email, password, nickname) VALUES (?, ?, ?)';
  db.query(sql, [email, hashedPassword, nickname], (err, result) => {
    if (err) return res.status(500).json({ message: '회원가입 실패', error: err });
    res.status(201).json({ message: '회원가입 성공' });
  });
});

// 로그인
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.query(sql, [email], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).json({ message: '사용자를 찾을 수 없음' });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: '비밀번호가 틀렸습니다' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '2h',
    });

    res.status(200).json({
      message: '로그인 성공',
      token,
      user: { id: user.id, email: user.email, nickname: user.nickname },
    });
  });
});

// 카카오 로그인
router.post('/auth/kakao', async (req, res) => {
  const { code } = req.body;
  const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
  const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;

  try {
    //카카오에 토큰 요청
    const tokenRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: REST_API_KEY,
        redirect_uri: REDIRECT_URI,
        code,
      },
    });

    const accessToken = tokenRes.data.access_token;

    //사용자 정보 요청
    const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const kakaoId = userRes.data.id;
    const email = userRes.data.kakao_account?.email || null;
    const nickname = userRes.data.kakao_account?.profile?.nickname || '카카오사용자';

    //사용자 DB 확인
    const checkSql = 'SELECT * FROM users WHERE kakao_id = ?';
    db.query(checkSql, [kakaoId], (err, results) => {
      if (err) return res.status(500).json({ message: 'DB 오류', error: err });

      if (results.length > 0) {
        const user = results[0];
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
          expiresIn: '2h',
        });
        return res.json({ token, user });
      } else {
        //사용자 새로 생성
        const insertSql = 'INSERT INTO users (kakao_id, email, nickname) VALUES (?, ?, ?)';
        db.query(insertSql, [kakaoId, email, nickname], (err2, result) => {
          if (err2) return res.status(500).json({ message: '회원가입 실패', error: err2 });

          const newUser = { id: result.insertId, email, nickname };
          const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET, {
            expiresIn: '2h',
          });
          return res.json({ token, user: newUser });
        });
      }
    });
  } catch (err) {
    res.status(500).json({ message: '카카오 로그인 실패', error: err.message });
  }
});

module.exports = router;
