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

// 🔹 chatUnreadCount: 일반 채팅 미읽음 개수
// 🔹 chatTripAlertCount: 메이트 확정/동행 시작 관련 알림 개수
const Header = ({ user, setUser, chatUnreadCount = 0, chatTripAlertCount = 0 }) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setDropdownOpen(false);
    navigate('/');
  };

  const hasUnread = Number(chatUnreadCount) > 0;
  const hasTripAlert = Number(chatTripAlertCount) > 0;

  const unreadLabel =
    Number(chatUnreadCount) > 99 ? '99+' :
    Number(chatUnreadCount) > 9 ? '9+' :
    chatUnreadCount;

  return (
    // 🔹 헤더를 항상 맨 위 레이어로
    <header className="relative z-30 flex justify-between items-center px-6 py-3 bg-white shadow">
      <div
        className="text-xl font-bold text-green-600 cursor-pointer"
        onClick={() => navigate('/')}
      >
        HereMate
      </div>

      <nav className="hidden md:flex gap-3 text-sm font-medium text-gray-700">
        {NAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-3 py-2 rounded-md transition flex items-center
               ${isActive ? 'bg-green-600 text-white shadow'
                          : 'hover:bg-zinc-100'}`
            }
          >
            {to === '/chat' ? (
              <div className="relative flex items-center gap-1">
                <span>내 채팅</span>

                {/* 라이트 알림: 일반 채팅 미읽음 */}
                {hasUnread && (
                  <span
                    className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                               rounded-full text-[11px] font-semibold
                               bg-emerald-500 text-white"
                  >
                    {unreadLabel}
                  </span>
                )}

                {/* 헤비 알림: 메이트 확정 / 동행 시작 */}
                {hasTripAlert && (
                  <span
                    className="ml-1 inline-flex items-center gap-1 px-2 py-[2px]
                               rounded-full text-[10px] font-semibold
                               bg-orange-100 text-orange-700
                               shadow-sm animate-pulse"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                    TRIP
                  </span>
                )}
              </div>
            ) : (
              label
            )}
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
              // 🔹 드롭다운도 확실하게 위로
              <div className="absolute right-0 mt-2 w-40 bg-white border rounded-md shadow-md z-40">
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
            <NavLink to="/login" className="text-gray-700 hover:text-green-600">로그인</NavLink>
            <NavLink to="/signup" className="text-gray-700 hover:text-green-600">회원가입</NavLink>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;