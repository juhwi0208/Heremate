// server/DB/db.js
require('dotenv').config(); // 꼭 추가
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});


db.connect((err) => {
  if (err) {
    console.error('MySQL 연결 오류:', err);
  } else {
    console.log('✅ MySQL 연결 성공');
  }
});

module.exports = db;
