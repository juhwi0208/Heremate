const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../db');
const { getKakaoUserInfo } = require('../services/kakaoAuth');
const { findOrCreateUser } = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

exports.kakaoCallback = async (req, res) => {
  const { code } = req.query;
    

  try {
    const kakaoUser = await getKakaoUserInfo(code);
    const user = await findOrCreateUser(kakaoUser);

    const token = jwt.sign({ id: user.id, nickname: user.nickname }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '카카오 로그인 실패' });
  }
};

exports.signup = async (req, res) => {
  const { email, password, nickname, kakaoId } = req.body;

  if (!email || !nickname || (!password && !kakaoId)) {
    return res.status(400).json({ error: '이메일, 닉네임, 비밀번호(또는 카카오ID)가 필요합니다.' });
  }

  try {
    const connection = await db.getConnection();

    const [existing] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: '이미 존재하는 이메일입니다.' });
    }

    let hashedPw = null;
    if (password) {
      hashedPw = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const [result] = await connection.query(
      'INSERT INTO users (email, password, nickname, kakao_id) VALUES (?, ?, ?, ?)',
      [email, hashedPw, nickname, kakaoId]
    );

    const user = { id: result.insertId, nickname };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({ user, token });
    connection.release();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '회원가입 실패' });
  }
};


exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }

  try {
    const connection = await db.getConnection();

    const [users] = await connection.query(
      'SELECT id, password, nickname, kakao_id FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '존재하지 않는 사용자입니다.' });
    }

    const user = users[0];

    if (!user.password) {
      return res.status(403).json({ error: '이 계정은 비밀번호가 없어 일반 로그인할 수 없습니다. (소셜 계정)' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    const token = jwt.sign({ id: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ user: { id: user.id, nickname: user.nickname }, token });
    connection.release();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '로그인 실패' });
  }
};

exports.checkEmail = async (req, res) => {
const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: '이메일이 필요합니다.' });
  }

  try {
    const connection = await db.getConnection();
    const [rows] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    connection.release();

    if (rows.length > 0) {
      res.json({ exists: true });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '중복 확인 실패' });
  }

};

exports.resetPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: '이메일이 필요합니다.' });

  try {
    const connection = await db.getConnection();
    const [rows] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ error: '존재하지 않는 이메일입니다.' });
    }

    // 1. 임시 비밀번호 생성
    const tempPassword = crypto.randomBytes(4).toString('hex'); // 예: 8자리
    const hashed = await bcrypt.hash(tempPassword, 10);

    // 2. 비밀번호 업데이트
    await connection.query('UPDATE users SET password = ? WHERE email = ?', [hashed, email]);
    connection.release();

    // 3. (이메일 전송 대신) 프론트에 직접 전달
    res.json({ tempPassword });
  } catch (err) {
    console.error('비밀번호 재설정 실패:', err);
    res.status(500).json({ error: '비밀번호 재설정 실패' });
  }
};
