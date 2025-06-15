// src/pages/KakaoRedirectHandler.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function KakaoRedirectHandler({ setUser }) {
  const [loading, setLoading] = useState(false); // 요청 중 여부 확인용
  const navigate = useNavigate();

  useEffect(() => {
  const code = new URL(window.location.href).searchParams.get("code");
  if (code) {
    setLoading(true); // 중복 방지용
    axios
      .get(`http://localhost:4000/auth/kakao/callback?code=${code}`)
      .then((res) => {
        const { user, token } = res.data;

        // ✅ localStorage에 토큰 저장
        localStorage.setItem('token', token);

        // ✅ 상태 저장
        setUser(user);
        navigate('/');
      })
      .catch((err) => {
        console.error('카카오 로그인 실패:', err);
        navigate('/');
      });
  }
  }, []);

  return <div>로그인 중입니다...</div>;
}

export default KakaoRedirectHandler;
