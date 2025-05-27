// index.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// DB 연결 설정
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// DB 연결 확인
db.connect((err) => {
  console.log("사용자명:", process.env.DB_USER);
  if (err) {
    console.error('MySQL 연결 실패:', err);
  } else {
    console.log('MySQL 연결 성공!');
  }
});

// 테스트용 API
app.get('/api/test', (req, res) => {
  res.send('백엔드 연결 성공!');
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});

const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);