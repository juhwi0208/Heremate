const db = require('../db'); // 네가 사용 중인 DB util 경로에 맞게 수정
const trustService = require('../services/trustService'); // ✅ 추가
module.exports = {
  /** Trip 생성 */
  async createTrip({ userA, userB, postId, chatRoomId, title, startDate, endDate }) {
  const [result] = await db.query(
    `INSERT INTO trips
       (user_a,
        user_b,
        mate_post_id,
        chat_room_id,
        title,
        start_date,
        end_date,
        status,
        meet_method,
        created_at,
        updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'none', NOW(), NOW())`,
    [userA, userB, postId, chatRoomId, title, startDate, endDate]
  );
  return result.insertId;
},

  /** Trip 조회 */
  async getTripByChatRoom(roomId) {
    const [rows] = await db.query(
      `SELECT * FROM trips
       WHERE chat_room_id = ? AND status IN ('pending','ready','met')
       ORDER BY id DESC LIMIT 1`,
      [roomId]
    );
    return rows[0] || null;
  },

  /** 초대 수락 */
  async acceptInvite(tripId) {
    const [res] = await db.query(
      `UPDATE trips
       SET status = 'ready', updated_at = NOW()
       WHERE id = ?`,
      [tripId]
    );
    return res.affectedRows > 0;
  },

  /** 초대 거절 */
  async declineInvite(tripId) {
    const [res] = await db.query(
      `UPDATE trips
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = ?`,
      [tripId]
    );
    return res.affectedRows > 0;
  },

  /** A안 시작(동시확인 버튼) */
  async startMeetButton(tripId, userId) {
    const [rows] = await db.query(`SELECT * FROM trips WHERE id = ?`, [tripId]);
    const trip = rows[0];
    if (!trip) return { ok: false, reason: 'not_found' };

    const now = Date.now();

    // 만료된 timestamp 제거 & 재시작 가능하도록 로직 처리
    if (trip.meet_expires_at && new Date(trip.meet_expires_at).getTime() < now) {
      await db.query(
        `UPDATE trips
          SET meet_started_by = NULL,
              meet_expires_at = NULL
        WHERE id = ?`,
        [tripId]
      );
      // 🔥 로컬 객체도 같이 리셋
      trip.meet_started_by = null;
      trip.meet_expires_at = null;
    }

    // 이미 내가 start 한 경우
    if (Number(trip.meet_started_by) === Number(userId)) {
      return { ok: true, phase: 'countdown', expiresAt: trip.meet_expires_at };
    }

    // 상대가 이미 시작했는지 확인
    if (trip.meet_started_by && Number(trip.meet_started_by) !== Number(userId)) {
      // 두 번째 유저가 눌렀음 → 성공으로 met 처리
      await db.query(
        `UPDATE trips
          SET met_at = NOW(),
              status = 'met',
              meet_method = 'button',
              meet_expires_at = NULL,
              meet_started_by = NULL,
              updated_at = NOW()
        WHERE id = ?`,
        [tripId]
      );

      // ✅ 이 시점에 두 사람 관계/별자리 갱신
      await trustService.onTripUpdate(trip.user_a, trip.user_b, tripId);

      return { ok: true, phase: 'met' };
    }

    // 처음 누르는 사람
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분
    await db.query(
      `UPDATE trips
        SET meet_started_by = ?, meet_expires_at = ?
      WHERE id = ?`,
      [userId, expiresAt, tripId]
    );

    return { ok: true, phase: 'countdown', expiresAt };
  },

  /** meetStatus 계산 */
  async getMeetStatus(tripId, userId) {
    const [rows] = await db.query(`SELECT * FROM trips WHERE id = ?`, [tripId]);
    const trip = rows[0];
    if (!trip) return { phase: 'none' };

    // met 완료
    if (trip.status === 'met') {
      return {
        phase: 'met',
        method: trip.meet_method,
        metAt: trip.met_at,
      };
    }

    // countdown 중인지 확인
    if (trip.meet_started_by) {
      const expiresAt = trip.meet_expires_at;
      const now = Date.now();
      const exp = new Date(expiresAt).getTime();

      if (exp > now) {
        const secondsLeft = Math.floor((exp - now) / 1000);
        return {
          phase: 'countdown',
          startedBy: trip.meet_started_by,
          expiresAt,
          secondsLeft,
        };
      }

      // 만료됨
      return {
        phase: 'expired',
      };
    }

    return {
      phase: 'idle',
    };
  },
};
