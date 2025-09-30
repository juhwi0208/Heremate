CREATE DATABASE IF NOT EXISTS heremate;
USE heremate;
ALTER TABLE users MODIFY COLUMN email VARCHAR(255) DEFAULT NULL;
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) DEFAULT NULL;


SELECT id, email, nickname,kakao_id
FROM users;

ALTER TABLE users ADD COLUMN provider VARCHAR(20) NOT NULL DEFAULT 'local';
CREATE INDEX idx_users_kakao_id ON users (kakao_id);
-- 1) 이메일은 로그인 수단: 유니크 + 소문자 정규화 전제
 ALTER TABLE users
  MODIFY email VARCHAR(255) NOT NULL;

CREATE UNIQUE INDEX uq_users_email ON users (email);

-- 2) 카카오 연동 계정 빠른 조회
CREATE INDEX idx_users_kakao_id ON users (kakao_id);

-- 3) 역할/이메일 검증 토큰 검색 최적화(선택)
CREATE INDEX idx_users_email_verify_token ON users (email_verify_token);
CREATE INDEX idx_users_reset_code ON users (reset_code);

-- 4) created_at 기본값(없다면)
ALTER TABLE users
  MODIFY created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
  
  
-- 닉네임 유니크 (중복 데이터 있으면 먼저 정리)
CREATE UNIQUE INDEX idx_users_nickname ON users (nickname);

-- heremate DB 선택
USE heremate;

-- plans 테이블 보강 (이미 있으면 IF NOT EXISTS로 건너뜀)
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS country VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS region  VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS prefs   JSON NULL,
  ADD COLUMN IF NOT EXISTS notes   JSON NULL,
  ADD COLUMN IF NOT EXISTS is_shared TINYINT(1) NOT NULL DEFAULT 0;

-- plan_items 테이블 보강
ALTER TABLE plan_items
  ADD COLUMN IF NOT EXISTS place_id       VARCHAR(128) NULL AFTER sort_order,
  ADD COLUMN IF NOT EXISTS opening_hours  JSON NULL AFTER place_id;

ALTER TABLE plan_items ADD COLUMN place_id      VARCHAR(128) NULL AFTER sort_order;
ALTER TABLE plan_items DROP COLUMN opening_hours;
ALTER TABLE plan_items ADD COLUMN opening_hours JSON NULL AFTER place_id;


SELECT table_name, column_name, data_type, is_nullable, column_key, column_default
FROM information_schema.columns
WHERE table_schema = 'heremate'
ORDER BY table_name, ordinal_position;



ALTER TABLE posts
  ADD COLUMN start_date DATE,
  ADD COLUMN end_date DATE;
  
  ALTER TABLE posts DROP COLUMN travel_date;
  
  ALTER TABLE chat_rooms 
  MODIFY created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ADD INDEX idx_chat_rooms_u1 (user1_id),
  ADD INDEX idx_chat_rooms_u2 (user2_id),
  ADD INDEX idx_chat_rooms_post (post_id);

ALTER TABLE messages
  MODIFY sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ADD INDEX idx_messages_room (chat_room_id),
  ADD INDEX idx_messages_sender (sender_id);
  
  
ALTER TABLE plans
  DROP COLUMN region;

ALTER TABLE plans
  ADD COLUMN country VARCHAR(100) NULL AFTER title,
  ADD COLUMN region  VARCHAR(100) NULL AFTER country;

-- 기존에 month 필드 없이도 풀데이트 저장 (start_date, end_date 그대로 유지)
-- 공유 피드/검색 성능을 위해 인덱스
CREATE INDEX idx_plans_shared_dates ON plans (is_shared, start_date, end_date);
CREATE INDEX idx_plans_country_region ON plans (country, region);

-- 컬럼 추가 (TINYINT(1) 대신 TINYINT 권장: 경고 방지)
ALTER TABLE plans
  ADD COLUMN is_shared TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN region VARCHAR(100) NULL,
  ADD COLUMN prefs JSON NULL;

-- 조회 최적화 인덱스
CREATE INDEX idx_plans_shared_dates ON plans (is_shared, start_date, end_date);
CREATE INDEX idx_plans_region ON plans (region);




SELECT * FROM users ORDER BY id DESC LIMIT 5;
ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user';
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';



-- 1. 사용자 테이블
CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) ,
  password VARCHAR(255),
  nickname VARCHAR(100) NOT null,
  kakao_id VARCHAR(255) UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 모집글 테이블
CREATE TABLE posts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  writer_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  travel_date DATE,
  location VARCHAR(255),
  view_count INT DEFAULT 0,
  is_matched BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (writer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. 채팅방 테이블
CREATE TABLE chat_rooms (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT,
  user1_id BIGINT NOT NULL,
  user2_id BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user1_id) REFERENCES users(id),
  FOREIGN KEY (user2_id) REFERENCES users(id)
);

-- 4. 메시지 테이블
CREATE TABLE messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  chat_room_id BIGINT NOT NULL,
  sender_id BIGINT NOT NULL,
  message TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- 5. 여행 계획 테이블
DROP TABLE IF EXISTS plans;

CREATE TABLE plans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(120) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  notes JSON NULL,                               -- {"2025-07-01":"메모", ...}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_plans_user (user_id)
);


-- 6. 여행 스토리 테이블
CREATE TABLE stories (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  title VARCHAR(255),
  description TEXT,
  photo_urls TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. 여행 계획_장소 테이블
CREATE TABLE IF NOT EXISTS plan_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  plan_id BIGINT NOT NULL,
  day DATE NOT NULL,                             -- 어느 날짜(YYYY-MM-DD)
  time VARCHAR(10) NULL,                         -- "10:00" 등 (선택)
  place_name VARCHAR(200) NULL,
  address VARCHAR(255) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  memo VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,             -- 같은 day 내 표시 순서
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_plan_items_plan (plan_id),
  INDEX idx_plan_items_day (day),
  CONSTRAINT fk_plan_items_plan
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    
);

-- 각 유저가 각 방을 마지막으로 읽은 시각
CREATE TABLE IF NOT EXISTS chat_room_reads (
  chat_room_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  last_read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chat_room_id, user_id),
  FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 조회 성능
CREATE INDEX idx_messages_room_sent ON messages (chat_room_id, sent_at, id);
