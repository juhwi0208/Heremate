// server/app.js
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const helmet = require('helmet');
const morgan = require('morgan');

// 1) 환경 로딩: B단계 로더 사용 (.env.dev / .env.prod)
require('./config/env');
const NODE_ENV = process.env.NODE_ENV || 'development';

// 2) DB (기존 pool 사용)
const db = require('./db');

// 3) 라우터
const authRouter   = require('./routes/auth');
const adminRouter  = require('./routes/admin');
const postRouter   = require('./routes/post');
const mateRouter   = require('./routes/mate');
const plansRouter  = require('./routes/plans');
const placesRouter = require('./routes/places');
const userRouter   = require('./routes/user');
const chatRouter   = require('./routes/chat');
const storiesRouter = require('./routes/stories');
const tripsRouter = require('./routes/trips');

const app = express();

// ────────────────────────────────────────────────────────────────
// 요청 ID + 구조화 로그 (네 기존 로직 유지)
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const start = Date.now();
  res.on('finish', () => {
    const log = {
      ts: new Date().toISOString(),
      reqId: req.id,
      userId: req.user?.id || null,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      dur_ms: Date.now() - start,
    };
    console.log(JSON.stringify(log));
  });
  next();
});
// ────────────────────────────────────────────────────────────────

// 보안 헤더 / 리버스 프록시 신뢰 / 요청 로깅
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(NODE_ENV === 'production' ? 'tiny' : 'dev'));

// CORS: CLIENT_ORIGIN + ALLOWED_ORIGINS(콤마) 지원
const allowlist = new Set(
  [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4000',      // ← 추가
    'http://127.0.0.1:4000',
    'https://heremate.vercel.app',
    'heremate-git-release-2025-10-14-juhwis-projects.vercel.app',      // ← 추가
    process.env.CLIENT_ORIGIN,
    ...(process.env.ALLOWED_ORIGINS || '')
    
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origin, cb) {
      // 포스트맨이나 서버 내부 호출처럼 Origin 없는 건 허용
      if (!origin) return cb(null, true);
      if (allowlist.has(origin)) return cb(null, true);
      console.warn('[CORS blocked]', origin); 
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);  

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health (DB ping)
app.get('/health', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 AS ok');
    const ok = rows?.[0]?.ok === 1;
    res.status(ok ? 200 : 500).json({
      ok,
      db: ok ? 'up' : 'down',
      env: NODE_ENV,
      time: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ ok: false, db: 'down', error: e.message });
  }
});

// 라우팅
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/api/posts', postRouter);
app.use('/api/mates', mateRouter);
app.use('/api/chats', chatRouter);
app.use('/api/plans', plansRouter);
app.use('/api/places', placesRouter);
app.use('/api/users', userRouter);
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/stories', storiesRouter);
app.use('/api/trips', tripsRouter);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// 에러 핸들러 (reqId 포함)
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const payload = {
    level: 'error',
    ts: new Date().toISOString(),
    reqId: req.id,
    userId: req.user?.id || null,
    path: req.originalUrl,
    status,
    message: err.message || 'Server Error',
  };
  if (NODE_ENV !== 'production' && err.stack) payload.stack = err.stack;
  console.error(JSON.stringify(payload));

  res.status(status).json({
    error: err.publicMessage || '서버 오류가 발생했습니다.',
    reqId: req.id,
  });
});

// 기동
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`[server] ${NODE_ENV} listening on :${PORT}`);
});
