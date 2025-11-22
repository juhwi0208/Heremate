// server/routes/trips.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middlewares/auth');
const tripController = require('../controllers/tripController');
const tripService = require('../services/tripService');

// POST /api/trips
// body: { chatRoomId:number, startDate:string(YYYY-MM-DD), endDate:string(YYYY-MM-DD), title?:string, matePostId?:number }
router.post('/', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { chatRoomId, startDate, endDate, title, matePostId } = req.body;

  if (!chatRoomId) {
    return res.status(400).json({ error: 'chatRoomId is required' });
  }
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  try {
    // 채팅방 정보 확인 + 상대 유저 / 게시글 찾기
    const [roomRows] = await db.query(
      'SELECT id, user1_id, user2_id, post_id FROM chat_rooms WHERE id=?',
      [chatRoomId]
    );
    if (!roomRows.length) {
      return res.status(404).json({ error: 'chat room not found' });
    }
    const room = roomRows[0];

    if (Number(room.user1_id) !== Number(userId) && Number(room.user2_id) !== Number(userId)) {
      return res.status(403).json({ error: 'not participant of this chat room' });
    }

    const otherUserId =
      Number(room.user1_id) === Number(userId) ? room.user2_id : room.user1_id;
    const finalMatePostId = matePostId || room.post_id || null;

    // 이미 살아있는 trip 있으면 막기 (pending/ready/met)
    const [existing] = await db.query(
      `SELECT *
       FROM trips
       WHERE mate_post_id <=> ?
         AND (
           (user_a = ? AND user_b = ?) OR
           (user_a = ? AND user_b = ?)
         )
         AND status IN ('pending', 'ready', 'met')
       ORDER BY id DESC
       LIMIT 1`,
      [finalMatePostId, userId, otherUserId, otherUserId, userId]
    );

    if (existing.length) {
      return res
        .status(400)
        .json({ error: 'active trip already exists for this pair/post', trip: existing[0] });
    }

    // trip 생성 (user_a = 나, user_b = 상대)
    const [result] = await db.query(
      `INSERT INTO trips (user_a, user_b, mate_post_id, title, start_date, end_date, meet_method, status)
       VALUES (?, ?, ?, ?, ?, ?, 'none', 'pending')`,
      [userId, otherUserId, finalMatePostId, title || null, startDate, endDate]
    );

    const [tripRows] = await db.query('SELECT * FROM trips WHERE id=?', [
      result.insertId,
    ]);
    return res.status(201).json({ trip: tripRows[0] });
  } catch (e) {
    console.error('POST /api/trips error', e);
    return res.status(500).json({ error: 'failed to create trip' });
  }
});

// POST /api/trips/:id/invite/accept
router.post('/:id/invite/accept', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM trips WHERE id=?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'trip not found' });
    }
    const trip = rows[0];

    if (
      Number(trip.user_a) !== Number(userId) &&
      Number(trip.user_b) !== Number(userId)
    ) {
      return res.status(403).json({ error: 'not participant of this trip' });
    }

    if (trip.status !== 'pending') {
      return res.status(400).json({ error: 'trip is not in pending status' });
    }

    await db.query(
      `UPDATE trips
       SET status='ready', updated_at = NOW()
       WHERE id=?`,
      [id]
    );

    const [updatedRows] = await db.query('SELECT * FROM trips WHERE id=?', [id]);
    return res.json({ trip: updatedRows[0] });
  } catch (e) {
    console.error('POST /api/trips/:id/invite/accept error', e);
    return res.status(500).json({ error: 'failed to accept trip invite' });
  }
});

// POST /api/trips/:id/invite/decline
router.post('/:id/invite/decline', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM trips WHERE id=?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'trip not found' });
    }
    const trip = rows[0];

    if (
      Number(trip.user_a) !== Number(userId) &&
      Number(trip.user_b) !== Number(userId)
    ) {
      return res.status(403).json({ error: 'not participant of this trip' });
    }

    if (trip.status !== 'pending') {
      return res.status(400).json({ error: 'trip is not in pending status' });
    }

    await db.query(
      `UPDATE trips
       SET status='cancelled', updated_at = NOW()
       WHERE id=?`,
      [id]
    );

    const [updatedRows] = await db.query('SELECT * FROM trips WHERE id=?', [id]);
    return res.json({ trip: updatedRows[0] });
  } catch (e) {
    console.error('POST /api/trips/:id/invite/decline error', e);
    return res.status(500).json({ error: 'failed to decline trip invite' });
  }
});

// POST /api/trips/:id/meet/button
// A안: 10분 카운트다운 기반 동행 시작 버튼
router.post('/:id/meet/button', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const tripId = req.params.id;

  try {
    // 1) A안 기본 로직 실행 (meet_started_by / meet_expires_at 갱신)
    const basic = await tripService.startMeetButton(tripId, userId);

    // 2) 최신 trip 다시 로드
    const [tripRows] = await db.query('SELECT * FROM trips WHERE id = ?', [
      tripId,
    ]);
    const trip = tripRows[0] || null;

    // 3) 현재 기준 meetStatus 계산
    const meetStatus = await tripService.getMeetStatus(tripId, userId);

    return res.json({
      trip,
      meetStatus,
      // 편의상 만료 시각도 같이 내려줌
      expiresAt: basic.expiresAt || meetStatus.expiresAt || null,
    });
  } catch (e) {
    console.error('POST /api/trips/:id/meet/button error', e);
    return res.status(500).json({ error: 'failed to process meet button' });
  }
});


module.exports = router;
