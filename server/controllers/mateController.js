// server/controllers/mateController.js
const db = require('../db');

exports.searchMates = async (req, res) => {
  const { location, style, me } = req.query;
  // me = 내가 작성한 글만 보고 싶을 때: /api/mates?me=1

  let sql = 'SELECT * FROM posts WHERE 1=1';
  const params = [];

  if (location) {
    sql += ' AND location LIKE ?';
    params.push(`%${location}%`);
  }

  if (style) {
    sql += ' AND travel_style LIKE ?';
    params.push(`%${style}%`);
  }

  // ⭐ me 필터: 내가 작성한 글만
  if (me) {
    sql += ' AND writer_id = ?';
    params.push(req.user.id);
  }

  try {
    const connection = await db.getConnection();
    const [rows] = await connection.query(sql, params);
    connection.release();
    res.json(rows);
  } catch (err) {
    console.error('메이트 검색 실패:', err);
    res.status(500).json({ error: '검색 실패' });
  }
};
