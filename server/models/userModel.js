// backend/models/userModel.js
const db = require('../db');

async function findOrCreateUser(kakaoUser) {
  const connection = await db.getConnection();

  try {
    // 1. 기존 사용자 조회
    const [rows] = await connection.query(
      'SELECT id, nickname FROM users WHERE kakao_id = ?',
      [kakaoUser.kakaoId]
    );

    if (rows.length > 0) {
      return { id: rows[0].id, nickname: rows[0].nickname };
    }

    // 2. 새 사용자 등록
    const [result] = await connection.query(
        'INSERT INTO users (kakao_id, nickname, email) VALUES (?, ?, ?)',
        [kakaoUser.kakaoId, kakaoUser.nickname, null]
    );

    return { id: result.insertId, nickname: kakaoUser.nickname };
  } finally {
    connection.release();
  }
}

module.exports = { findOrCreateUser };
