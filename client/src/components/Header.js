//C:\Users\owner\Documents\GitHub\Heremate\client\src\components\Header.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Header = ({ user, setUser }) => {
  const navigate = useNavigate();

  return (
    <header style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
      {user ? (
        <>
          <span>👤 {user.nickname}</span>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              setUser(null);
              navigate('/');
            }}
          >
            로그아웃
          </button>
        </>
      ) : (
        <>
          <Link to="/login">
            <button>로그인</button>
          </Link>
          <Link to="/signup">
            <button>회원가입</button>
          </Link>
        </>
      )}
    </header>
  );
};

export default Header;


