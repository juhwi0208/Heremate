// src/components/Header.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';


const Header = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  return (
    <header className="flex justify-between items-center px-6 py-3 bg-white shadow-md">
      <div className="text-xl font-bold text-green-600 cursor-pointer" onClick={() => navigate('/')}>HereMate</div>

      <nav className="hidden md:flex gap-20 text-sm font-medium text-gray-700">
        <Link to="/recommend" className="hover:text-green-600">관광지 검색</Link>
        <Link to="/mate" className="hover:text-green-600">여행메이트 찾기</Link>
        <Link to="/plans" className="hover:text-green-600">여행 계획</Link>
        <Link to="/stories" className="hover:text-green-600">여행 스토리</Link>
        <Link to="/chat" className="hover:text-green-600">내 채팅</Link>
        
      </nav>

      <div className="relative">
        {user ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 text-sm text-gray-800 hover:text-green-600"
            >
              👤 {user.nickname}
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white border rounded-md shadow-md z-10">
                <button
                  onClick={() => navigate('/mypage')}
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
            <Link to="/login" className="text-gray-700 hover:text-green-600">로그인</Link>
            <Link to="/signup" className="text-gray-700 hover:text-green-600">회원가입</Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
