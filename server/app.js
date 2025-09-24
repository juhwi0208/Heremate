// server\app.js
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// app.js 초반 (server 시작 전에 임시로 넣고 테스트)
const nodemailer = require('nodemailer');

(async () => {
  try {
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await t.verify();
    console.log('[SMTP] 연결 OK');
  } catch (e) {
    console.error('[SMTP] 연결 실패:', e.message);
  }
})();

const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const postRouter = require('./routes/post');
const mateRouter = require('./routes/mate');
const plansRouter = require('./routes/plans');
const placesRouter = require('./routes/places');
const userRouter = require('./routes/user');


const app = express();
app.use(cors({
  origin: 'http://localhost:3000', 
  credentials: true,               // 쿠키/인증정보 허용
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(cookieParser()); 
app.use(express.json());
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/api/posts', postRouter);
app.use('/api/mates', mateRouter);
app.use('/api/chats', require('./routes/chat'));
app.use('/api/plans', plansRouter);
app.use('/api/places', placesRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/users', userRouter);

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
