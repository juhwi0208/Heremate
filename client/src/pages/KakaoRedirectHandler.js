// src/pages/KakaoRedirectHandler.js
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axiosInstance';

export default function KakaoRedirectHandler({ setUser }) {
  const navigate = useNavigate();
  const guard = useRef(false);

  useEffect(() => {
    if (guard.current) return;
    guard.current = true;

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (!code) { navigate('/login'); return; }

    (async () => {
      try {
        const { data } = await axios.get(`/auth/kakao/callback?code=${encodeURIComponent(code)}`);
        const token = data?.token || data?.accessToken;
        if (token) localStorage.setItem('token', token);

        // 내 프로필 동기화
        const me = await axios.get('/api/users/me');
        if (typeof setUser === 'function' && me?.data) {
          setUser({
            id: me.data.id, nickname: me.data.nickname, email: me.data.email,
            role: me.data.role, avatarUrl: me.data.avatarUrl || null,
          });
        }

        // 쿼리 정리
        window.history.replaceState({}, document.title, '/auth/kakao/callback');
        navigate('/');
      } catch (err) {
        const msg = err?.response?.data?.error;
        const code = err?.response?.data?.code;
        // 일반계정 이메일 → 수동 연동 안내
        if (code === 'NEEDS_LINKING') {
          alert(msg || '일반 로그인 계정입니다. 일반 로그인 후 카카오 연동을 진행해 주세요.');
          window.history.replaceState({}, document.title, '/auth/kakao/callback');
          navigate('/login');
          return;
        }
        console.error('카카오 로그인 실패:', err);
        window.history.replaceState({}, document.title, '/auth/kakao/callback');
        navigate('/login');
      }
    })();
  }, [navigate, setUser]);

  return <div className="p-6 text-sm text-zinc-600">카카오 로그인 처리 중…</div>;
}
