// server/routes/trips.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middlewares/auth');

/**
 * trips 테이블 (현재 기준)
 *  id           bigint AI PK
 *  user_a       bigint
 *  user_b       bigint
 *  mate_post_id bigint
 *  title        varchar(200)
 *  start_date   date
 *  end_date     date
 *  met_at       datetime
 *  meet_method  enum('button','gps','none')
 *  status       enum('pending','ready','met','finished','cancelled')
 *  created_at   datetime
 *  updated_at   datetime
 */

// 날짜만 비교하기 위한 헬퍼 (시간은 00:00 기준으로 통일)
function normalizeDateOnly(d) {
  if (!d) return null;
  if (d instanceof Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const tmp = new Date(d);
  return new Date(tmp.getFullYear(), tmp.getMonth(), tmp.getDate());
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

// trips.row 하나로 오늘 기준 상태 계산
function deriveStatus(trip) {
  const now = new Date();
  const today = normalizeDateOnly(now);
  const start = trip.start_date ? normalizeDateOnly(trip.start_date) : null;
  const end = trip.end_date ? normalizeDateOnly(trip.end_date) : null;

  // 여행 날짜 기준 phase
  let phase = 'unknown'; // before | during | after
  if (start && end) {
    if (today < start) phase = 'before';
    else if (today > end) phase = 'after';
    else phase = 'during';
  }

  // 기본 state는 DB status 그대로 시작
  let state = trip.status || 'pending';

  // met_at 있으면 무조건 met로 본다
  if (trip.met_at) {
    state = 'met';
  } else if (state === 'met' && !trip.met_at) {
    // status만 met인데 met_at 없으면 ready로 보정
    state = 'ready';
  }

  // 여행 기간이 지났는데 met_at 없고 cancel도 아니면 사실상 no_meet
  let noMeet = false;
  if (!trip.met_at && phase === 'after' && state !== 'cancelled') {
    noMeet = true;
  }

  // 동행 시작 버튼 노출 가능 여부
  const canStart =
    phase === 'during' &&
    !trip.met_at &&
    state !== 'cancelled';

  // 후기 작성 가능 여부:
  //  - met_at 존재
  //  - 오늘이 end_date 이후이면서 end_date+14일 이내
  let canReview = false;
  if (trip.met_at && end) {
    const reviewStart = addDays(end, 0);   // 종료일 당일/이후부터
    const reviewEnd = addDays(end, 14);    // 종료 후 14일까지
    if (today >= reviewStart && today <= reviewEnd) {
      canReview = true;
    }
  }

  return {
    phase,
    state,
    noMeet,
    canStart,
    canReview,
  };
}

// GET /api/trips/:id/meet/status
router.get('/:id/meet/status', verifyToken, async (req, res) => {
  const tripId = req.params.id;
  const userId = req.user.id;

  try {
    const [rows] = await db.query('SELECT * FROM trips WHERE id = ?', [tripId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'trip not found' });
    }
    const trip = rows[0];

    // 참여자가 아니면 접근 불가
    if (Number(trip.user_a) !== Number(userId) && Number(trip.user_b) !== Number(userId)) {
      return res.status(403).json({ error: 'not a participant of this trip' });
    }

    const {
      phase,
      state,
      noMeet,
      canStart,
      canReview,
    } = deriveStatus(trip);

    const me_role = Number(trip.user_a) === Number(userId) ? 'a' : 'b';
    const partner_id = me_role === 'a' ? trip.user_b : trip.user_a;

    return res.json({
      id: trip.id,
      title: trip.title,
      mate_post_id: trip.mate_post_id,
      start_date: trip.start_date,
      end_date: trip.end_date,
      met_at: trip.met_at,
      meet_method: trip.meet_method,

      // 정제된 상태
      status: state,          // 'pending' | 'ready' | 'met' | 'finished' | 'cancelled' (보정 포함)
      raw_status: trip.status, // DB 원본도 같이 내려줌

      phase,                  // 'before' | 'during' | 'after'
      no_meet: noMeet,        // 기간 지났는데 met_at 없는 경우 true
      can_start: canStart,    // 지금 "동행 시작" 버튼 노출 가능한지
      can_review: canReview,  // 지금 후기 작성 가능 여부

      me_role,                // 'a' or 'b'
      partner_id,
      today: normalizeDateOnly(new Date()),
    });
  } catch (e) {
    console.error('GET /api/trips/:id/meet/status error', e);
    return res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
