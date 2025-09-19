// server\app.js
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const postRoutes = require('./routes/post');
const mateRoutes = require('./routes/mate');
const plansRouter = require('./routes/plans');
const placesRouter = require('./routes/places');


const app = express();
app.use(cors({
  origin: 'http://localhost:3000', // 개발 프런트 오리진을 '정확히' 지정
  credentials: true,               // 쿠키/인증정보 허용
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(cookieParser()); 
app.use(express.json());
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/api/posts', postRoutes);
app.use('/api/mates', mateRoutes);
app.use('/api/chats', require('./routes/chat'));
app.use('/api/plans', plansRouter);
app.use('/api/places', placesRouter);
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
