// src/pages/Home.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  const goToLogin = () => {
    navigate('/login');
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>HereMate에 오신 것을 환영합니다!</h1>
      <button
        onClick={goToLogin}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          borderRadius: '8px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          marginTop: '20px'
        }}
      >
        로그인하기
      </button>
    </div>
  );
}

export default Home;
