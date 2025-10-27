// src/components/Header.js
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const NAV = [
  { to: '/recommend', label: '관광지 검색' },
  { to: '/mate',      label: '여행메이트 찾기' },
  { to: '/plans',     label: '여행 계획' },
  { to: '/stories',   label: '여행 스토리' },
  { to: '/chat',      label: '내 채팅' },
];

const Header = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  return (
    <header className="flex justify-between items-center px-6 py-3 bg-white">
      <div className="text-xl font-bold text-green-600 cursor-pointer" onClick={() => navigate('/')}>HereMate</div>

      {/* 🟢 NavLink로 교체 + isActive 하이라이트 */}
      <nav className="hidden md:flex gap-3 text-sm font-medium text-gray-700">
        {NAV.map(({to, label}) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-3 py-2 rounded-md transition
               ${isActive ? 'bg-green-600 text-white shadow'
                          : 'hover:bg-zinc-100'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="relative">
        {user ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 text-sm text-gray-800 hover:text-green-600"
            >
              <img
                src={user.avatarUrl || "/assets/avatar_placeholder.png"}
                alt="프로필"
                className="w-6 h-6 rounded-full object-cover border"
              />
              {user.nickname}
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
            <NavLink to="/login" className="text-gray-700 hover:text-green-600">로그인</NavLink>
            <NavLink to="/signup" className="text-gray-700 hover:text-green-600">회원가입</NavLink>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;