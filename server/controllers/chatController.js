// server/controllers/chatController.js
const db = require("../db");
const tripService = require("../services/tripService");

exports.getTripOfRoom = async (req, res) => {
  const me = req.user.id;
  const roomId = req.params.id;

  try {
    // 1) 채팅방 정보 조회
    const [roomRows] = await db.query(
      `SELECT id, user1_id, user2_id, post_id 
       FROM chat_rooms 
       WHERE id = ?`,
      [roomId]
    );
    if (!roomRows.length) {
      return res.status(404).json({ error: "chat room not found" });
    }
    const room = roomRows[0];

    // 2) 참가자인지 확인
    if (room.user1_id !== me && room.user2_id !== me) {
      return res.status(403).json({ error: "forbidden" });
    }

    const otherUserId = room.user1_id === me ? room.user2_id : room.user1_id;

    // 3) 게시글 여행 날짜 조회 (start_date, end_date)
    let postStart = null;
    let postEnd = null;
    if (room.post_id) {
      const [postRows] = await db.query(
        `SELECT start_date, end_date 
         FROM posts 
         WHERE id = ?`,
        [room.post_id]
      );
      if (postRows.length) {
        postStart = postRows[0].start_date;
        postEnd = postRows[0].end_date;
      }
    }

    // 4) trip 조회
    const [tripRows] = await db.query(
      `SELECT * 
       FROM trips
       WHERE mate_post_id <=> ?
         AND (
            (user_a = ? AND user_b = ?) OR 
            (user_a = ? AND user_b = ?)
         )
         AND status IN ('pending','ready','met')
       ORDER BY id DESC
       LIMIT 1`,
      [room.post_id, me, otherUserId, otherUserId, me]
    );

    const trip = tripRows.length ? tripRows[0] : null;

    // 5) meetStatus 조회
    const meetStatus = trip
      ? await tripService.getMeetStatus(trip.id, me)
      : { phase: "none" };

    // 6) 최종 응답 (프론트가 필요로 하는 구조)
    return res.json({
      trip,
      meetStatus,
      post_start_date: postStart,
      post_end_date: postEnd,
    });
  } catch (e) {
    console.error("getTripOfRoom error", e);
    return res.status(500).json({ error: "failed to load trip" });
  }
};
