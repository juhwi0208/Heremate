// src/pages/Login.js
//프론트엔드 카카오 로그인 버튼
import React from 'react';
import KakaoLoginButton from '../components/KakaoLoginButton';

function Login() {
  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
      <h2>로그인</h2>
      <KakaoLoginButton />
    </div>
  );
}

export default Login;

