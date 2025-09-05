// server/routes/chat.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middlewares/auth'); // 프로젝트에 맞게

// [POST] 방 생성(또는 기존 방 찾기)
// body: { targetUserId:number, postId?:number }
router.post('/rooms', verifyToken, async (req, res) => {
  const me = req.user.id;
  const { targetUserId, postId = null } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId 필요' });

  try {
    // ① 같은 두 유저 사이의 기존 방 탐색 (postId도 고려)
    const params = [me, targetUserId, targetUserId, me];
    let sql =
      `SELECT id FROM chat_rooms
       WHERE ((user1_id=? AND user2_id=?) OR (user1_id=? AND user2_id=?))`;
    if (postId) { sql += ` AND post_id = ?`; params.push(postId); }
    sql += ` LIMIT 1`;

    const [found] = await db.query(sql, params);
    if (found.length) return res.json({ roomId: found[0].id });

    // ② 없으면 새로 생성
    const [r] = await db.query(
      `INSERT INTO chat_rooms(post_id, user1_id, user2_id) VALUES (?,?,?)`,
      [postId, me, targetUserId]
    );
    return res.json({ roomId: r.insertId });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'room create failed' });
  }
});

// [GET] 내 방 목록
router.get('/rooms', verifyToken, async (req, res) => {
  const me = req.user.id;
  try {
    const [rows] = await db.query(
      `SELECT id, post_id, user1_id, user2_id, created_at
       FROM chat_rooms
       WHERE user1_id=? OR user2_id=?
       ORDER BY created_at DESC`,
      [me, me]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'list rooms failed' });
  }
});

// [GET] 메시지 목록 (증분 after)
router.get('/rooms/:id/messages', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { after } = req.query; // ISO 문자열
  try {
    const params = [id];
    let sql =
      `SELECT id, chat_room_id, sender_id, message, sent_at
       FROM messages
       WHERE chat_room_id=?`;
    if (after) { sql += ` AND sent_at > ?`; params.push(after); }
    sql += ` ORDER BY sent_at ASC LIMIT 200`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'list messages failed' });
  }
});

// [POST] 메시지 전송
router.post('/rooms/:id/messages', verifyToken, async (req, res) => {
  const { id } = req.params;           // chat_room_id
  const me = req.user.id;
  const { content } = req.body;        // 프론트는 content로 보냄
  if (!content?.trim()) return res.status(400).json({ error: 'content 필요' });

  try {
    const [r] = await db.query(
      `INSERT INTO messages(chat_room_id, sender_id, message) VALUES (?,?,?)`,
      [id, me, content]
    );
    const [rows] = await db.query(
      `SELECT id, chat_room_id, sender_id, message, sent_at
       FROM messages WHERE id=?`,
      [r.insertId]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'send failed' });
  }
});

module.exports = router;
