// src/pages/KakaoRedirectHandler.js
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axiosInstance';

function KakaoRedirectHandler({ setUser }) {
/**
 * 카카오 인가코드(code) → 서버로 교환 → 토큰 저장 → 내 프로필(/api/users/me) 재조회 → 전역 user 갱신
 * - StrictMode로 useEffect가 2회 호출되는 상황을 guard로 방지
 * - 주소창의 ?code 제거 (뒤로가기/새로고침시 재호출 방지)
 * - 서버 응답에 user가 없더라도 /api/users/me로 확실히 avatarUrl 포함 프로필 동기화
 */
export default function KakaoRedirectHandler({ setUser }) {
  const navigate = useNavigate();
  const guard = useRef(false);

  useEffect(() => {
    if (guard.current) return;
    guard.current = true;

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (!code) {
      // 인가코드 없으면 로그인으로
      navigate('/login');
      return;
    }

    (async () => {
      try {
        // 1) code → 서버로 교환 (토큰 반환 받음)
        const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
        const { data } = await axios.get(
          `${API}/auth/kakao/callback?code=${encodeURIComponent(code)}`
        );
        const token = data?.token || data?.accessToken;
        if (token) {
          localStorage.setItem('token', token);
        }

        // 2) ✅ 꼭! 내 프로필을 다시 조회해 avatarUrl(절대URL 포함)을 전역에 반영
        const me = await axios.get('/api/users/me');
        if (typeof setUser === 'function' && me?.data) {
          setUser({
            id: me.data.id,
            nickname: me.data.nickname,
            email: me.data.email,
            role: me.data.role,
            avatarUrl: me.data.avatarUrl || null, // 서버가 절대URL 내려주도록 컨트롤러 수정 권장
          });
        }

        // 3) 주소에서 ?code 제거 (중복처리 방지)
        window.history.replaceState({}, document.title, '/auth/kakao/callback');

        // 4) 원하는 페이지로 이동
        navigate('/');
      } catch (err) {
        console.error('카카오 로그인 실패:', err);
        // 실패해도 ?code 제거
        window.history.replaceState({}, document.title, '/auth/kakao/callback');
        navigate('/login'); // 필요 시 홈('/')으로 변경 가능
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="p-6 text-sm text-zinc-600">
      카카오 로그인 처리 중…
    </div>
  );
}

