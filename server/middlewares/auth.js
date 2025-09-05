// C:\Users\owner\Documents\GitHub\Heremate\server\middlewares\auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // 서버 시작 단계에서 환경변수 누락을 바로 알림 (로그만 남기고 서버는 계속 뜨게)
  console.warn('[auth] WARNING: JWT_SECRET is not set. Set it in your .env!');
}

// 사용자 인증
exports.verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || ''; // e.g. "Bearer <token>"
    const [scheme, token] = authHeader.split(' ');

    if (!token || !/^Bearer$/i.test(scheme)) {
      return res.status(401).json({ error: '인증 토큰 형식이 올바르지 않습니다.' });
    }
    if (!JWT_SECRET) {
      return res.status(500).json({ error: '서버 설정 오류(JWT_SECRET 미설정).' });
    }

    // clockTolerance로 서버/클라이언트 시계 약간의 오차 허용(선택)
    const decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: 5 });

    // 필요한 필드만 주입 (안전하게)
    const { id, nickname, role } = decoded || {};
    if (!id) {
      return res.status(401).json({ error: '유효하지 않은 토큰(사용자 ID 없음).' });
    }

    req.user = { id, nickname, role: role || 'user' };
    req.token = token; // 필요 시 다음 미들웨어에서 사용 가능
    return next();
  } catch (err) {
    // 에러 유형에 따라 메시지 분기
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '토큰이 만료되었습니다.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
    console.error('[auth] verifyToken error:', err);
    return res.status(401).json({ error: '토큰 검증 중 오류가 발생했습니다.' });
  }
};

// 관리자 권한 확인
exports.requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '관리자만 접근할 수 있습니다.' });
  }
  return next();
};
