// client/src/App.js
import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import axios from './api/axiosInstance';

import AdminUsers from './pages/AdminUser';
import AdminHome from './pages/AdminHome';

import Header from './components/Header';
import Home from './pages/Home';
import Landing from './pages/Landing';

import SignUp from './pages/SignUp';
import KakaoRedirectHandler from './pages/KakaoRedirectHandler';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import MyPage from './pages/MyPage';
import EmailChange from './pages/EmailChange';

import MateList from './features/mate/MateList';
import MateForm from './features/mate/MateForm';
import MateDetail from './features/mate/MateDetail';

import ChatPage from './features/chat/ChatPage';

import Recommend from './features/recommend/Recommend';

import PlanList from './features/plan/pages/PlanList';

// ✅ 변경: PlanEditor의 새로운 경로 반영
import PlanEditor from './features/plan/pages/PlanEditor/PlanEditor';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      // 1차: 토큰 정보로 즉시 표시
      setUser({ id: decoded.id, nickname: decoded.nickname });

      // 2차: 서버 프로필로 덮어쓰기(avatarUrl 포함)
      axios.get('/api/users/me').then(({ data }) => {
        setUser((u) => ({
          ...u,
          nickname: data?.nickname ?? u?.nickname,
          avatarUrl: data?.avatarUrl || u?.avatarUrl,
          email: data?.email ?? u?.email,
          role: data?.role ?? u?.role,
        }));
      });
    } catch (err) {
      console.error('토큰 디코딩 실패', err);
      localStorage.removeItem('token');
    }
  }, []);

  const Stories = () => <div className="p-6">스토리 준비 중</div>;

  return (
    <>
      <Header user={user} setUser={setUser} />

      {/* 🟢 메인 컨테이너 */}
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-6xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={user ? <Home user={user} /> : <Landing />} />
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/signup" element={<SignUp setUser={setUser} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/mypage" element={<MyPage setUser={setUser} />} />
            <Route path="/account/email" element={<EmailChange />} />
            <Route path="/auth/kakao/callback" element={<KakaoRedirectHandler setUser={setUser} />} />

            {/* 관리자 페이지 */}
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin" element={<AdminHome user={user} />} />

            {/* 메이트 관련 */}
            <Route path="/mate" element={<MateList />} />
            <Route path="/mate/new" element={<MateForm />} />
            <Route path="/mate/:id" element={<MateDetail />} />

            {/* 채팅 */}
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:id" element={<ChatPage />} />

            {/* 추천 기능 */}
            <Route path="/recommend" element={<Recommend />} />

            {/* 여행 계획 관련 */}
            <Route path="/plans" element={<PlanList />} />
            <Route path="/plans/new" element={<PlanEditor />} />
            <Route path="/plans/:id" element={<PlanEditor />} />
            <Route path="/plans/:id/readonly" element={<PlanEditor />} />

            {/* 스토리 (준비 중) */}
            <Route path="/stories" element={<Stories />} />

            {/* 404 */}
            <Route path="*" element={<div className="p-6">페이지를 찾을 수 없습니다.</div>} />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default App;
