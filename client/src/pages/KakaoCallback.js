import React, { useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function KakaoCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const code = new URL(window.location.href).searchParams.get('code');

    if (code) {
      axios.post('http://localhost:3001/api/auth/kakao', { code })
        .then((res) => {
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          alert('카카오 로그인 성공!');
          navigate('/');
        })
        .catch((err) => {
          console.error('카카오 로그인 실패:', err);
          alert('로그인 실패');
          navigate('/login');
        });
    }
  }, [navigate]);

  return <p>로그인 처리 중입니다...</p>;
}

export default KakaoCallback;
