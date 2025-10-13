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
import PlanEditor from './features/plan/pages/PlanEditor';

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

      {/* 🟢 헤더 아래 배경 띠 */}
      <div className="w-full bg-[#F8FAFC] border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 py-3 text-sm text-zinc-600">
          {/* 필요하면 현재 탭 설명/브레드크럼 넣는 영역 */}
        </div>
      </div>
      

      {/* 🟢 메인 컨테이너 */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          {/* 이하 기존 Routes 그대로 이동 */}
          <Route path="/" element={user ? <Home user={user} /> : <Landing />} />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/signup" element={<SignUp setUser={setUser} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/mypage" element={<MyPage setUser={setUser} />} />
          <Route path="/account/email" element={<EmailChange />} />
          <Route path="/auth/kakao/callback" element={<KakaoRedirectHandler setUser={setUser} />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin" element={<AdminHome user={user} />} />
          <Route path="/mate" element={<MateList />} />
          <Route path="/mate/new" element={<MateForm />} />
          <Route path="/mate/:id" element={<MateDetail />} />
          <Route path="/chat" element={<ChatPage/>} />
          <Route path="/chat/:id" element={<ChatPage />} />
          <Route path="/recommend" element={<Recommend />} />
          <Route path="/plans/new" element={<PlanEditor />} />
          <Route path="/plans/:id" element={<PlanEditor />} />
          <Route path="/plans" element={<PlanList />} />
          <Route path="/plans/:id/readonly" element={<PlanEditor />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="*" element={<div className="p-6">페이지를 찾을 수 없습니다.</div>} />
        </Routes>
      </main>
    </>
  );
}

export default App;

