const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

// ✅ 전체 회원 목록 조회 (관리자만 접근)
router.get('/users', verifyToken, requireAdmin, async (req, res) => {
  try {
    const connection = await db.getConnection();
    const [users] = await connection.query(
      'SELECT id, email, nickname, role, created_at FROM users'
    );
    connection.release();
    res.json(users);
  } catch (err) {
    console.error('회원 목록 조회 실패:', err);
    res.status(500).json({ error: '회원 목록 조회 실패' });
  }
});

router.delete('/users/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await db.getConnection();
    await connection.query('DELETE FROM users WHERE id = ?', [id]);
    connection.release();
    res.json({ success: true });
  } catch (err) {
    console.error('사용자 삭제 실패:', err);
    res.status(500).json({ error: '사용자 삭제 실패' });
  }
});


module.exports = router;
