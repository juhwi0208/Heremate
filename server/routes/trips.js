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

// GET /api/trips/:id/review/eligibility
// - 내가 이 trip의 참가자인지
// - 동행이 실제로 시작되었는지(status='met')
// - 여행 날짜가 지났는지(end_date < 오늘)
// - 이미 같은 대상에게 리뷰를 남겼는지
router.get('/:id/review/eligibility', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    // trip + 연결된 메이트 게시글 날짜 조회
    const [rows] = await db.query(
      `
      SELECT 
        t.*,
        p.start_date AS post_start_date,
        p.end_date   AS post_end_date
      FROM trips t
      LEFT JOIN posts p
        ON p.id = t.mate_post_id
      WHERE t.id = ?
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ canReview: false, reason: 'TRIP_NOT_FOUND' });
    }

    const trip = rows[0];

    // 참가자인지 확인
    if (Number(trip.user_a) !== Number(userId) && Number(trip.user_b) !== Number(userId)) {
      return res.status(403).json({ canReview: false, reason: 'NOT_PARTICIPANT' });
    }

    // 실제 동행이 성사되었는지 (meet 버튼으로 met 처리된 상태)
    if (trip.status !== 'met') {
      return res.status(400).json({ canReview: false, reason: 'TRIP_NOT_MET' });
    }

    // 여행 종료 날짜 계산 (posts.end_date 우선, 없으면 trips.end_date 사용)
    const endDateStr = trip.post_end_date || trip.end_date;
    if (!endDateStr) {
      return res
        .status(400)
        .json({ canReview: false, reason: 'TRIP_DATE_MISSING' });
    }

    const today = new Date();
    const endDate = new Date(endDateStr);

    // 오늘이 여행 종료일 이후가 아니면 후기 작성 불가
    if (today <= endDate) {
      return res.status(400).json({
        canReview: false,
        reason: 'TRIP_NOT_FINISHED',
      });
    }

    // 타겟 유저 계산 (상대방)
    const targetId =
      Number(trip.user_a) === Number(userId) ? Number(trip.user_b) : Number(trip.user_a);

    // 이미 같은 trip, 같은 대상에게 리뷰를 남겼는지 확인
    const [reviewRows] = await db.query(
      `SELECT id FROM reviews WHERE reviewer_id = ? AND target_id = ? AND trip_id = ? LIMIT 1`,
      [userId, targetId, id]
    );

    if (reviewRows.length) {
      return res.status(400).json({
        canReview: false,
        reason: 'ALREADY_REVIEWED',
      });
    }

    // 타겟 프로필 정보도 같이 내려주면 프론트에서 보여주기 좋음
    const [userRows] = await db.query(
      `SELECT id, nickname, avatar_url FROM users WHERE id = ?`,
      [targetId]
    );
    const targetUser = userRows[0] || null;

    return res.json({
      canReview: true,
      reason: null,
      trip: {
        id: trip.id,
        status: trip.status,
        start_date: trip.post_start_date || trip.start_date,
        end_date: trip.post_end_date || trip.end_date,
      },
      targetUser,
    });
  } catch (e) {
    console.error('GET /api/trips/:id/review/eligibility error', e);
    return res.status(500).json({ canReview: false, reason: 'INTERNAL_ERROR' });
  }
});

// POST /api/trips/:id/reviews
// body: { emotion: 'positive' | 'neutral' | 'negative', tags: string[], comment?: string }
router.post('/:id/reviews', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { emotion, tags, comment } = req.body;

  try {
    // emotion 검증
    const allowed = ['positive', 'neutral', 'negative'];
    if (!allowed.includes(emotion)) {
      return res.status(400).json({ error: 'invalid emotion' });
    }

    // tags: 배열(최대 3개) 체크
    let finalTags = [];
    if (Array.isArray(tags)) {
      finalTags = tags.filter((t) => typeof t === 'string').slice(0, 3);
    }

    // comment 길이 제한
    let finalComment = comment || '';
    if (typeof finalComment !== 'string') {
      finalComment = '';
    }
    if (finalComment.length > 500) {
      finalComment = finalComment.slice(0, 500);
    }

    // trip + post 날짜 재조회 (eligibility와 거의 동일)
    const [rows] = await db.query(
      `
      SELECT 
        t.*,
        p.start_date AS post_start_date,
        p.end_date   AS post_end_date
      FROM trips t
      LEFT JOIN posts p
        ON p.id = t.mate_post_id
      WHERE t.id = ?
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'trip not found' });
    }

    const trip = rows[0];

    // 참가자인지 확인
    if (Number(trip.user_a) !== Number(userId) && Number(trip.user_b) !== Number(userId)) {
      return res.status(403).json({ error: 'not participant of this trip' });
    }

    if (trip.status !== 'met') {
      return res.status(400).json({ error: 'trip not met yet' });
    }

    const endDateStr = trip.post_end_date || trip.end_date;
    if (!endDateStr) {
      return res.status(400).json({ error: 'trip date missing' });
    }
    const today = new Date();
    const endDate = new Date(endDateStr);
    if (today <= endDate) {
      return res.status(400).json({ error: 'trip not finished yet' });
    }

    // 타겟 유저
    const targetId =
      Number(trip.user_a) === Number(userId) ? Number(trip.user_b) : Number(trip.user_a);

    // 중복 리뷰 방지
    const [reviewRows] = await db.query(
      `SELECT id FROM reviews WHERE reviewer_id = ? AND target_id = ? AND trip_id = ? LIMIT 1`,
      [userId, targetId, id]
    );
    if (reviewRows.length) {
      return res.status(400).json({ error: 'already reviewed' });
    }

    // INSERT
    const [result] = await db.query(
      `
      INSERT INTO reviews
        (reviewer_id, target_id, trip_id, emotion, tags, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
      `,
      [userId, targetId, id, emotion, JSON.stringify(finalTags), finalComment]
    );

    const [insertedRows] = await db.query(
      `SELECT * FROM reviews WHERE id = ?`,
      [result.insertId]
    );

    return res.status(201).json({ review: insertedRows[0] });
  } catch (e) {
    console.error('POST /api/trips/:id/reviews error', e);
    return res.status(500).json({ error: 'failed to create review' });
  }
});

// GET /api/trips/rooms/:roomId
router.get('/rooms/:roomId', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { roomId } = req.params;

  try {
    // chat_room_id 기준으로 살아있는 trip 조회 (pending/ready/met)
    const trip = await tripService.getTripByChatRoom(roomId);

    if (!trip) {
      // trip이 없으면 null 내려주고 프론트에서는 배너 안보이게
      return res.json(null);
    }

    // 참가자 검증
    if (
      Number(trip.user_a) !== Number(userId) &&
      Number(trip.user_b) !== Number(userId)
    ) {
      return res.status(403).json({ error: 'not participant of this trip' });
    }

    // 내가 이 trip에 대해 이미 후기 썼는지 확인
    const [reviewRows] = await db.query(
      `SELECT id FROM reviews WHERE reviewer_id = ? AND trip_id = ? LIMIT 1`,
      [userId, trip.id]
    );
    const hasReview = reviewRows.length > 0;

    // TripBanner에서 바로 쓰기 편하게, trip 객체 + has_review를 평탄하게 내려줌
    return res.json({
      ...trip,
      has_review: hasReview,
    });
  } catch (e) {
    console.error('GET /api/trips/rooms/:roomId error', e);
    return res.status(500).json({ error: 'failed to load trip by room' });
  }
});

// PATCH /api/trips/:id  - 여행 날짜 변경
router.patch('/:id', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { start_date, end_date } = req.body;

  if (!start_date || !end_date) {
    return res
      .status(400)
      .json({ error: 'start_date and end_date are required' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM trips WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'trip not found' });
    }
    const trip = rows[0];

    // 참가자 검증
    if (
      Number(trip.user_a) !== Number(userId) &&
      Number(trip.user_b) !== Number(userId)
    ) {
      return res.status(403).json({ error: 'not participant of this trip' });
    }

    // 이미 동행 완료된(trip.status = 'met') 여행은 날짜 변경 불가
    if (trip.status === 'met') {
      return res.status(400).json({ error: 'trip already met' });
    }

    await db.query(
      `UPDATE trips
       SET start_date = ?, end_date = ?, updated_at = NOW()
       WHERE id = ?`,
      [start_date, end_date, id]
    );

    const [updatedRows] = await db.query('SELECT * FROM trips WHERE id = ?', [
      id,
    ]);
    const updated = updatedRows[0];

    return res.json(updated);
  } catch (e) {
    console.error('PATCH /api/trips/:id error', e);
    return res.status(500).json({ error: 'failed to update trip dates' });
  }
});

// POST /api/trips/:id/cancel  - 메이트 확정 취소
router.post('/:id/cancel', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM trips WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'trip not found' });
    }
    const trip = rows[0];

    // 참가자 검증
    if (
      Number(trip.user_a) !== Number(userId) &&
      Number(trip.user_b) !== Number(userId)
    ) {
      return res.status(403).json({ error: 'not participant of this trip' });
    }

    // 이미 동행 완료된 경우 취소 불가
    if (trip.status === 'met') {
      return res.status(400).json({ error: 'trip already met' });
    }

    await db.query(
      `UPDATE trips
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/trips/:id/cancel error', e);
    return res.status(500).json({ error: 'failed to cancel trip' });
  }
});


module.exports = router;
