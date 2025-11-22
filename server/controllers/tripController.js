const tripService = require('../services/tripService');

module.exports = {
  /** Trip 생성 */
  createTrip: async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        user_b,
        mate_post_id,
        chat_room_id,
        title,
        start_date,
        end_date,
      } = req.body;

      const id = await tripService.createTrip({
        userA: userId,
        userB: user_b,
        postId: mate_post_id,
        chatRoomId: chat_room_id,
        title,
        startDate: start_date,
        endDate: end_date,
      });

      res.status(201).json({ id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'failed to create trip' });
    }
  },

  /** 초대 수락 */
  acceptInvite: async (req, res) => {
    try {
      const tripId = req.params.id;
      const ok = await tripService.acceptInvite(tripId);
      res.json({ ok });
    } catch (err) {
      res.status(500).json({ error: 'failed' });
    }
  },

  /** 초대 거절 */
  declineInvite: async (req, res) => {
    try {
      const tripId = req.params.id;
      const ok = await tripService.declineInvite(tripId);
      res.json({ ok });
    } catch (err) {
      res.status(500).json({ error: 'failed' });
    }
  },

  /** A안: 동행 시작 버튼 */
  startMeetButton: async (req, res) => {
    try {
      const userId = req.user.id;
      const tripId = req.params.id;
      const result = await tripService.startMeetButton(tripId, userId);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'failed' });
    }
  },

  /** meetStatus */
  meetStatus: async (req, res) => {
    try {
      const userId = req.user.id;
      const tripId = req.params.id;
      const status = await tripService.getMeetStatus(tripId, userId);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: 'failed' });
    }
  },
};
