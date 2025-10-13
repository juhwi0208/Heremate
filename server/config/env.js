const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev';
const envPath = path.join(__dirname, '..', envFile);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // 최후의 수단: server/.env (현재 레포에 존재)
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
}

const required = ['PORT','CLIENT_ORIGIN','DB_HOST','DB_USER','DB_NAME','JWT_SECRET'];
for (const k of required) {
  if (!process.env[k]) console.warn(`[env] Missing ${k} in ${envFile}`);
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 4000),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  DB: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  },
  JWT: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  SMTP: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE).toLowerCase() !== 'false',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};
