import React, { useEffect, useState } from "react";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function KakaoCallback() {
  const navigate = useNavigate();
  const [called, setCalled] = useState(false);

  useEffect(() => {
    if (called) return;
    const code = new URL(window.location.href).searchParams.get('code');
    if (!code) return;
    setCalled(true);

    axios.post('http://localhost:3001/api/auth/kakao', { code })
      .then((res) => {
        if (res.data.newUser) {
          // 신규 유저면 /signup으로 정보 전달
          navigate('/signup', { state: { 
            kakaoId: res.data.kakaoId, 
            email: res.data.email, 
            nickname: res.data.nickname 
          } });
        } else {
          // 기존 유저 로그인 처리
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          navigate('/', { replace: true });
        }
      })
      .catch((err) => {
        console.error('카카오 로그인 실패:', err);
        alert('카카오 로그인 중 오류가 발생했습니다.');
      });

  }, [called, navigate]);

  return <p>로그인 처리 중입니다...</p>;
}

export default KakaoCallback;

