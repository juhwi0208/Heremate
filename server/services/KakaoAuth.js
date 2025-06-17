// backend/services/kakaoAuth.js
const axios = require('axios');

const REST_API_KEY = '3711275ed6eadb3c397d486504269a15';
const REDIRECT_URI = 'http://localhost:3000/auth/kakao/callback';

async function getKakaoUserInfo(code) {
  // 1. 액세스 토큰 요청
  const tokenRes = await axios.post(
    'https://kauth.kakao.com/oauth/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: REST_API_KEY,
      redirect_uri: REDIRECT_URI,
      code,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const accessToken = tokenRes.data.access_token;

  // 2. 사용자 정보 요청
  const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const { id, properties } = userRes.data;

  return {
    kakaoId: id,
    nickname: properties?.nickname || '사용자',
  };
}

module.exports = { getKakaoUserInfo };
