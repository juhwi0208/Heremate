// server/controllers/postController.js
const db = require('../db');

// 헬퍼: 문자열/배열 모두 배열로 정규화
function toArray(maybe) {
  if (!maybe) return [];
  if (Array.isArray(maybe)) return maybe;
  if (typeof maybe === 'string') return maybe.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

/**
 * GET /api/posts
 * Query: location, style(콤마구분 다중), startDate, endDate
 * - 날짜는 "겹치는 기간"을 모두 포함: (post.start <= filterEnd) AND (post.end >= filterStart)
 * - 유저 join으로 nickname, avatarUrl 포함
 */
exports.getAllPosts = async (req, res) => {
  const { location, style, startDate, endDate } = req.query;

  const styles = toArray(style);
  const params = [];
  let where = 'WHERE 1=1';

  if (location) {
    where += ' AND p.location LIKE ?';
    params.push(`%${location}%`);
  }

  // 날짜 겹침 로직
  if (startDate && endDate) {
    where += ' AND (p.start_date <= ? AND p.end_date >= ?)';
    params.push(endDate, startDate);
  } else if (startDate) {
    // 시작일만 있으면 해당 일과 겹치는 것
    where += ' AND (p.end_date >= ?)';
    params.push(startDate);
  } else if (endDate) {
    // 종료일만 있으면 해당 일과 겹치는 것
    where += ' AND (p.start_date <= ?)';
    params.push(endDate);
  }

  // 다중 취향: posts.travel_style 은 콤마로 저장
  if (styles.length) {
    where += ' AND (';
    where += styles.map(() => `FIND_IN_SET(?, p.travel_style) > 0`).join(' OR ');
    where += ')';
    params.push(...styles);
  }

  const sql = `
    SELECT
      p.*,
      u.nickname,
      u.avatar_url AS avatarUrl
    FROM posts p
    JOIN users u ON u.id = p.writer_id
    ${where}
    ORDER BY p.created_at DESC
  `;

  try {
    const conn = await db.getConnection();
    const [rows] = await conn.query(sql, params);
    conn.release();

    // 클라이언트가 쓰기 좋게 배열로 변환
    const result = rows.map(r => ({
      ...r,
      travel_styles: (r.travel_style || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    }));
    res.json(result);
  } catch (err) {
    console.error('게시글 조회 실패:', err);
    res.status(500).json({ error: '게시글 조회 실패' });
  }
};

exports.createPost = async (req, res) => {
  const { title, content, start_date, end_date, location, travel_styles, travel_style } = req.body;
  const writer_id = req.user?.id;

  if (!title || !writer_id) {
    return res.status(400).json({ error: '필수 입력값이 부족합니다.' });
  }

  // 호환성: 예전 단일 필드(travel_style)도 수용
  const stylesArr = toArray(travel_styles?.length ? travel_styles : travel_style);
  if (!stylesArr.length) {
    return res.status(400).json({ error: '여행 취향을 한 가지 이상 선택해주세요.' });
  }
  const stylesCSV = stylesArr.join(',');

  try {
    const conn = await db.getConnection();
    await conn.query(
      `INSERT INTO posts (writer_id, title, content, start_date, end_date, location, travel_style, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [writer_id, title, content || '', start_date, end_date, location || '', stylesCSV]
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
      SELECT p.*, u.nickname, u.avatar_url AS avatarUrl
      FROM posts p
      JOIN users u ON p.writer_id = u.id
      WHERE p.id = ?
    `, [id]);
    conn.release();

    if (!rows.length) return res.status(404).json({ error: '게시글 없음' });

    const r = rows[0];
    r.travel_styles = (r.travel_style || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    res.json(r);
  } catch (err) {
    console.error('게시글 상세 실패:', err);
    res.status(500).json({ error: '게시글 조회 실패' });
  }
};

exports.updatePost = async (req, res) => {
  const { id } = req.params;
  const { title, content, start_date, end_date, location, travel_styles, travel_style } = req.body;

  const stylesCSV = toArray(travel_styles?.length ? travel_styles : travel_style).join(',');

  try {
    const conn = await db.getConnection();
    await conn.query(
      `UPDATE posts
         SET title = ?, content = ?, start_date = ?, end_date = ?, location = ?, travel_style = ?
       WHERE id = ?`,
      [title, content, start_date, end_date, location, stylesCSV, id]
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
  const userId = req.user?.id; // verifyToken 에서 넣어준 사용자 id

  if (!userId) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  try {
    const conn = await db.getConnection();

    // 내가 쓴 글만 삭제되도록 writer_id까지 함께 조건으로 건다
    const [result] = await conn.query(
      'DELETE FROM posts WHERE id = ? AND writer_id = ?',
      [id, userId]
    );

    conn.release();

    if (result.affectedRows === 0) {
      // 1) 글이 이미 없거나  2) 내가 쓴 글이 아닌 경우
      return res
        .status(404)
        .json({ error: '게시글을 찾을 수 없거나 삭제 권한이 없습니다.' });
    }

    return res.json({ message: '게시글 삭제 성공' });
  } catch (err) {
    console.error('게시글 삭제 실패:', err);
    return res.status(500).json({ error: '게시글 삭제 실패' });
  }
};