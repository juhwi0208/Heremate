import React from 'react';

const REST_API_KEY = process.env.REACT_APP_KAKAO_REST_API_KEY;
const REDIRECT_URI = 'http://localhost:3000/oauth/kakao/callback';

function KakaoLoginButton() {
  const handleKakaoLogin = () => {
    const kakaoURL = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code`;
    window.location.href = kakaoURL;
  };

  return (
    <button
      onClick={handleKakaoLogin}
      style={{
        backgroundColor: '#FEE500',
        border: 'none',
        padding: '10px 20px',
        fontWeight: 'bold',
        cursor: 'pointer',
        borderRadius: '5px'
      }}
    >
      카카오로 로그인
    </button>
  );
}

export default KakaoLoginButton;
