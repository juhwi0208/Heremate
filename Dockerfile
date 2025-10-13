# Node 20 LTS 이미지
FROM node:20-alpine

# 작업 디렉터리
WORKDIR /app

# server 의 패키지 먼저 복사/설치 (레이어 캐시 최적화)
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

# 나머지 서버 소스 복사
COPY server/. .

# 운영 모드 & 포트
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# 앱 시작
CMD ["node", "app.js"]
