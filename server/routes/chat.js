// server/routes/chat.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middlewares/auth'); // 프로젝트에 맞게
const chatController = require('../controllers/chatController');

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


// [PUT] 방 읽음 갱신
router.put('/rooms/:id/read', verifyToken, async (req, res) => {
  const me = req.user.id;
  const { id } = req.params;

  try {
    await db.query(
      `INSERT INTO chat_room_reads (chat_room_id, user_id, last_read_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE last_read_at = GREATEST(last_read_at, NOW())`,
      [id, me]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'read update failed' });
  }
});



// [GET] 내 방 목록 (+상대 프로필, 게시글 제목/지역/스타일, 읽지않음, trip 알림)
router.get('/rooms', verifyToken, async (req, res) => {
  const me = req.user.id;

  try {
    const [rows] = await db.query(
      `
      SELECT 
        r.id,
        r.post_id,
        r.user1_id,
        r.user2_id,
        r.created_at,

        -- 상대 유저
        CASE WHEN r.user1_id = ? THEN r.user2_id ELSE r.user1_id END AS other_id,
        u.nickname       AS other_nickname,
        u.avatar_url     AS other_avatar_url,
        CASE WHEN u.nickname LIKE '탈퇴회원%' THEN 0 ELSE 1 END AS other_active,

        -- 연결된 메이트 게시글
        p.title          AS post_title,
        p.location       AS post_location,
        p.travel_style   AS post_style,

        -- 안 읽은 메시지 개수
        COALESCE(unread.cnt, 0) AS unread_count,

        -- 🔥 메이트 확정/동행 관련 강한 알림 여부
        (
          SELECT 
            CASE 
              WHEN COUNT(*) > 0 THEN 1
              ELSE 0
            END
          FROM trips t
          WHERE t.mate_post_id <=> r.post_id
            AND (
                  (t.user_a = r.user1_id AND t.user_b = r.user2_id)
               OR (t.user_a = r.user2_id AND t.user_b = r.user1_id)
                )
            AND t.status IN (
              'pending',      -- 메이트 확정 요청
              'ready',        -- 여행 확정
              'met',          -- 만남 완료
              'meet_pending', -- 한 명이 동행 시작 버튼 누른 상태
              'meet_waiting', -- 대기
              'meet_button',  -- 버튼 프로토타입용
              'meet_countdown'-- 카운트다운 진행 중
            )
        ) AS has_trip_alert

      FROM chat_rooms r

      JOIN users u
        ON u.id = CASE WHEN r.user1_id = ? THEN r.user2_id ELSE r.user1_id END

      LEFT JOIN posts p
        ON p.id = r.post_id

      -- 안 읽은 메시지 서브쿼리
      LEFT JOIN (
        SELECT m.chat_room_id, COUNT(*) AS cnt
        FROM messages m
        LEFT JOIN chat_room_reads rr
          ON rr.chat_room_id = m.chat_room_id
         AND rr.user_id = ?
        WHERE m.sender_id <> ?
          AND (rr.last_read_at IS NULL OR m.sent_at > rr.last_read_at)
        GROUP BY m.chat_room_id
      ) AS unread
        ON unread.chat_room_id = r.id

      WHERE r.user1_id = ? OR r.user2_id = ?

      ORDER BY r.created_at DESC
      `,
      // ? 순서: other_id, users join, unread 서브쿼리(2개), where(2개)
      [me, me, me, me, me, me]
    );

    res.json(rows);
  } catch (e) {
    console.error('GET /api/chats/rooms error:', e);
    res.status(500).json({ error: 'list rooms failed' });
  }
});



// [GET] 이 채팅방에 연결된 최신 trip + meetStatus
router.get('/rooms/:id/trip', verifyToken, chatController.getTripOfRoom);



module.exports = router;
