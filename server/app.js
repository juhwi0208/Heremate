// server/app.js
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

// ── 1) .env 환경 로딩 ──────────────────────────────────────────────
const nodeEnv = process.env.NODE_ENV || 'development';
const dotenvFile = nodeEnv === 'production' ? '.env.prod' : '.env.local';
require('dotenv').config({ path: path.join(__dirname, dotenvFile) });

// ── 2) DB 풀 로딩(경로 확인: controllers들이 `../db`를 import하므로 server/db.js 권장) ─
const db = require('./db'); // ← server/db.js 로 위치 맞춰주세요

// ── 3) 라우터 ─────────────────────────────────────────────────────
const authRouter  = require('./routes/auth');
const adminRouter = require('./routes/admin');
const postRouter  = require('./routes/post');
const mateRouter  = require('./routes/mate');
const plansRouter = require('./routes/plans');
const placesRouter= require('./routes/places');
const userRouter  = require('./routes/user');

// ── 4) 앱 생성 & 기본 미들웨어 ─────────────────────────────────────
const app = express();

// 요청 ID 부여 + 간단 구조화 로그
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const start = Date.now();
  res.on('finish', () => {
    // 최소 필수 필드(요청ID, userId, path, status, message)
    const log = {
      ts: new Date().toISOString(),
      reqId: req.id,
      userId: req.user?.id || null,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      dur_ms: Date.now() - start,
    };
    // 콘솔은 라인당 JSON 1개(파이프라인 수집기에서 파싱 용이)
    console.log(JSON.stringify(log));
  });
  next();
});

// CORS: 환경 변수(ALLOWED_ORIGINS=comma)로 제어
const whitelist = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    // 모바일 앱/서버간 통신 등 Origin이 없을 수도 있으니 허용(필요시 tighten)
    if (!origin || whitelist.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(cookieParser());
app.use(express.json());

// 정적 업로드
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── 5) 헬스체크( DB ping 포함 ) ────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    // mysql2/promise 풀은 ping이 없으므로 간단 쿼리로 대체
    const [rows] = await db.query('SELECT 1 AS ok');
    res.status(200).json({
      ok: true,
      db: rows?.[0]?.ok === 1 ? 'up' : 'unknown',
      env: nodeEnv,
      version: process.env.APP_VERSION || null,
      time: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ ok: false, db: 'down', error: e.message });
  }
});

// ── 6) 라우팅 ─────────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/api/posts', postRouter);
app.use('/api/mates', mateRouter);
app.use('/api/chats', require('./routes/chat'));
app.use('/api/plans', plansRouter);
app.use('/api/places', placesRouter);
app.use('/api/users', userRouter);

// ── 7) 에러 핸들러(구조화 로그 + reqId 반환) ───────────────────────
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
  if (nodeEnv !== 'production' && err.stack) payload.stack = err.stack;
  console.error(JSON.stringify(payload));

  res.status(status).json({
    error: err.publicMessage || '서버 오류가 발생했습니다.',
    reqId: req.id,
  });
});

// ── 8) 서버 시작 ───────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`[server] ${nodeEnv} listening on :${PORT}`);
});
