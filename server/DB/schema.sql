CREATE DATABASE IF NOT EXISTS heremate;
USE heremate;

-- 1. 사용자 테이블
CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nickname VARCHAR(100),
  age INT,
  gender ENUM('male', 'female', 'other'),
  preferences TEXT,
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
CREATE TABLE plans (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  title VARCHAR(255),
  travel_start DATE,
  travel_end DATE,
  locations TEXT,
  memo TEXT,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
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