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

    // 현재 URL에서 쿼리 전체(code, state 등)를 그대로 가져옴
    const search = window.location.search || '';
    if (!search.includes('code=')) {
      // code 자체가 없으면 그냥 로그인 페이지로
      navigate('/login');
      return;
    }

    (async () => {
      try {
        // 쿼리 전체를 그대로 서버로 전달
        const qs = search.startsWith('?') ? search.substring(1) : search;
        const { data } = await axios.get(`/auth/kakao/callback?${qs}`);

        const token = data?.token || data?.accessToken;
        if (token) {
          localStorage.setItem('token', token);
        }

        // 내 프로필 동기화
        const me = await axios.get('/api/users/me');
        if (typeof setUser === 'function' && me?.data) {
          setUser({
            id: me.data.id,
            nickname: me.data.nickname,
            email: me.data.email,
            role: me.data.role,
            avatarUrl: me.data.avatarUrl || null,
          });
        }

        // 주소 깔끔하게 정리 후 홈으로
        window.history.replaceState({}, document.title, '/auth/kakao/callback');
        navigate('/');
      } catch (err) {
        const msg = err?.response?.data?.error;
        const code = err?.response?.data?.code;

        // 🔍 디버깅용: 실제 에러 콘솔에 찍기
        console.error('카카오 로그인 실패:', err?.response?.data || err);

        // 일반계정 이메일 → 수동 연동 안내
        if (code === 'NEEDS_LINKING') {
          alert(
            msg || '일반 로그인 계정입니다. 일반 로그인 후 카카오 연동을 진행해 주세요.'
          );
          window.history.replaceState({}, document.title, '/auth/kakao/callback');
          navigate('/login');
          return;
        }

        // 그 외에는 그냥 로그인 페이지로 돌려보내기
        window.history.replaceState({}, document.title, '/auth/kakao/callback');
        navigate('/login');
      }
    })();
  }, [navigate, setUser]);

  return <div className="p-6 text-sm text-zinc-600">카카오 로그인 처리 중…</div>;
}
