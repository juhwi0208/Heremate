//C:\Users\owner\Documents\GitHub\Heremate\server\middlewares\auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

// 사용자 인증
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: '토큰이 없습니다.' });
  }

  const token = authHeader.split(' ')[1]; // 'Bearer TOKEN'

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // 사용자 정보 저장
    next();
  } catch (err) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
};

// 관리자 권한 확인
exports.requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '관리자만 접근할 수 있습니다.' });
  }
  next();
};
