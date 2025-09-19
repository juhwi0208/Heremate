// src/pages/KakaoRedirectHandler.js
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axiosInstance';

function KakaoRedirectHandler({ setUser }) {
  const navigate = useNavigate();
  const guard = useRef(false); // ✅ 중복 호출 가드

  useEffect(() => {
    if (guard.current) return;  // ✅ StrictMode로 2회 호출 방지
    guard.current = true;

    const code = new URL(window.location.href).searchParams.get('code');
    if (!code) {
      // code가 없으면 로그인 페이지나 홈으로 보냄
      navigate('/login'); // 필요 시 '/' 로 바꿔도 OK
      return;
    }

    (async () => {
      try {
        const res = await axios.get(`/auth/kakao/callback?code=${encodeURIComponent(code)}`);
        // 서버 응답 구조에 맞춰 필드명 조정
        const user = res.data?.user;
        const token = res.data?.token || res.data?.accessToken;

        if (token) localStorage.setItem('token', token);
        if (typeof setUser === 'function' && user) setUser(user);

        // ✅ 주소에서 ?code 제거: 뒤로가기/새로고침 시 재호출 방지
        window.history.replaceState({}, document.title, '/auth/kakao/callback');

        // 성공 후 원하는 경로로 이동
        navigate('/');
      } catch (err) {
        console.error('카카오 로그인 실패:', err);
        // 실패 시에도 ?code 제거(중복 교환 방지)
        window.history.replaceState({}, document.title, '/auth/kakao/callback');
        navigate('/login'); // 필요 시 '/' 로 조정
      }
    })();
  }, [navigate]);

  return <div>로그인 처리 중...</div>;
}

export default KakaoRedirectHandler;
