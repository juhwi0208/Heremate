// src/components/Header.js
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Header = ({ user, setUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  // 현재 경로와 시작이 일치하면 활성화로 간주
  const isActive = (path) => location.pathname.startsWith(path);
  const navClass = (path) =>
    isActive(path)
      ? 'text-green-600 border-b-2 border-green-600 pb-1'
      : 'text-gray-700 hover:text-green-600';

  return (
    <header className="flex justify-between items-center px-6 py-3 bg-white shadow-md">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="text-xl font-bold text-green-600 cursor-pointer"
        aria-label="HereMate 홈으로 이동"
      >
        HereMate
      </button>

      <nav className="hidden md:flex gap-20 text-sm font-medium">
        <Link to="/recommend" className={navClass('/recommend')}>
          관광지 검색
        </Link>
        <Link to="/mate" className={navClass('/mate')}>
          여행메이트 찾기
        </Link>
        <Link to="/plans" className={navClass('/plans')}>
          여행 계획
        </Link>
        <Link to="/stories" className={navClass('/stories')}>
          여행 스토리
        </Link>
        <Link to="/chat" className={navClass('/chat')}>
          내 채팅
        </Link>
      </nav>

      <div className="relative">
        {user ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 text-sm text-gray-800 hover:text-green-600"
            >
              <img
                src={user.avatarUrl || '/assets/avatar_placeholder.png'}
                alt="프로필"
                className="w-6 h-6 rounded-full object-cover border"
              />
              {user.nickname}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white border rounded-md shadow-md z-10">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/mypage');
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                >
                  마이페이지
                </button>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-red-500"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-4 text-sm">
            <Link to="/login" className="text-gray-700 hover:text-green-600">
              로그인
            </Link>
            <Link to="/signup" className="text-gray-700 hover:text-green-600">
              회원가입
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
