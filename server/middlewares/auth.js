// server/middlewares/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * 로그인한 사용자 확인
 * - Authorization: Bearer <token> 필요
 */
function verifyToken(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: '토큰이 없습니다.' });

  try {
    req.user = jwt.verify(token, JWT_SECRET); // { id, nickname, role }
    next();
  } catch (e) {
    return res.status(401).json({ error: '유효하지 않은 토큰' });
  }
}

/**
 * 관리자 권한 확인
 * - req.user.role === 'admin' 이어야 통과
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '관리자만 접근할 수 있습니다.' });
  }
  next();
}

module.exports = { verifyToken, requireAdmin };
