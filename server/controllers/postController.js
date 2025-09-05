// controllers/postController.js
const db = require('../db');

exports.getAllPosts = async (req, res) => {
  const { location, style, startDate, endDate } = req.query;

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

  if (startDate) {
    sql += ' AND start_date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    sql += ' AND end_date <= ?';
    params.push(endDate);
  }

  sql += ' ORDER BY created_at DESC';

  try {
    const conn = await db.getConnection();
    const [rows] = await conn.query(sql, params);
    conn.release();
    res.json(rows);
  } catch (err) {
    console.error('게시글 조회 실패:', err);
    res.status(500).json({ error: '게시글 조회 실패' });
  }
};



exports.createPost = async (req, res) => {
  const { title, content, start_date, end_date, location, travel_style } = req.body;
  const writer_id = req.user?.id;

  if (!title || !writer_id || !travel_style) {
    return res.status(400).json({ error: '필수 입력값이 부족합니다.' });
  }

  try {
    const conn = await db.getConnection();
    await conn.query(
      `INSERT INTO posts (writer_id, title, content, start_date, end_date, location, travel_style)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [writer_id, title, content, start_date, end_date, location, travel_style]
    );
    conn.release();
    res.status(201).json({ message: '게시글 등록 성공' });
  } catch (err) {
    console.error('게시글 등록 실패:', err);
    res.status(500).json({ error: '게시글 등록 실패' });
  }
};


exports.getPostById = async (req, res) => {
  const { id } = req.params;
  try {
    const conn = await db.getConnection();
    const [rows] = await conn.query(`
        SELECT posts.*, users.nickname 
        FROM posts
        JOIN users ON posts.writer_id = users.id
        WHERE posts.id = ?
    `, [id]);
    conn.release();

    if (rows.length === 0) return res.status(404).json({ error: '게시글 없음' });
    res.json(rows[0]);
  } catch (err) {
    console.error('게시글 상세 실패:', err);
    res.status(500).json({ error: '게시글 조회 실패' });
  }
};

exports.updatePost = async (req, res) => {
  const { id } = req.params;
  const { title, content, start_date, end_date, location } = req.body;

  try {
    const conn = await db.getConnection();
    await conn.query(
      'UPDATE posts SET title = ?, content = ?, start_date = ?, end_date = ?, location = ? WHERE id = ?',
      [title, content, start_date, end_date, location, id]
    );
    conn.release();
    res.json({ message: '게시글 수정 성공' });
  } catch (err) {
    console.error('게시글 수정 실패:', err);
    res.status(500).json({ error: '게시글 수정 실패' });
  }
};

exports.deletePost = async (req, res) => {
  const { id } = req.params;
  try {
    const conn = await db.getConnection();
    await conn.query('DELETE FROM posts WHERE id = ?', [id]);
    conn.release();
    res.json({ message: '게시글 삭제 성공' });
  } catch (err) {
    console.error('게시글 삭제 실패:', err);
    res.status(500).json({ error: '게시글 삭제 실패' });
  }
};
