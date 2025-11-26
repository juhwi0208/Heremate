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

  const totalChatBadge = chatTripAlertCount || chatUnreadCount;

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
    } catch (e) {
      // ignore
    }
    if (setUser) setUser(null);
    navigate('/');
  };

  const navClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-full whitespace-nowrap text-sm transition
     ${isActive
       ? 'bg-emerald-600 text-white'
       : 'text-gray-700 hover:bg-emerald-50'}`;

  const renderNavItem = (item) => {
    const isChat = item.to === '/chat';

    return (
      <NavLink key={item.to} to={item.to} className={navClass}>
        <span className="inline-flex items-center gap-1">
          {item.label}
          {isChat && totalChatBadge > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-[10px] text-white min-w-[16px] h-4 px-1">
              {totalChatBadge}
            </span>
          )}
        </span>
      </NavLink>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-zinc-200">
      {/* 상단 바 (로고 + 데스크톱 탭 + 유저/로그인 영역) */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* 로고 / 타이틀 */}
        <button
          type="button"
          onClick={handleLogoClick}
          className="flex items-center gap-2"
        >
          <span className="text-emerald-600 font-black tracking-tight text-xl">
            HereMate
          </span>
        </button>

        {/* 데스크톱용 탭 (md 이상에서만 보이도록) */}
        <nav className="hidden md:flex items-center gap-4 flex-1 justify-center">
          {NAV.map(renderNavItem)}
        </nav>

        {/* 우측 유저 / 로그인 영역 */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-sm"
              >
                <span className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs text-emerald-700 font-semibold">
                  {user.nickname?.[0] || '유'}
                </span>
                <span className="max-w-[80px] truncate text-gray-800">
                  {user.nickname || '사용자'}
                </span>
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
                    onClick={() => {
                      setDropdownOpen(false);
                      handleLogout();
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-red-600"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-4 text-sm">
              <NavLink to="/login" className="text-gray-700 hover:text-green-600">
                로그인
              </NavLink>
              <NavLink to="/signup" className="text-gray-700 hover:text-green-600">
                회원가입
              </NavLink>
            </div>
          )}
        </div>
      </div>

      {/* 🔻 모바일용 탭 바 (핸드폰에서만 보이게) */}
      <nav className="md:hidden border-t border-zinc-100">
        <div className="max-w-6xl mx-auto px-3 py-2 flex gap-2 overflow-x-auto no-scrollbar">
          {NAV.map(renderNavItem)}
        </div>
      </nav>
    </header>
  );
};

export default Header;
