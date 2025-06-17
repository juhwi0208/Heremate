// client/src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode'; 

import AdminUsers from './pages/AdminUser';
import AdminHome from './pages/AdminHome';

import Header from './components/Header';
import Home from './pages/Home';
import Landing from './pages/Landing';

import SignUp from './pages/SignUp';
import KakaoRedirectHandler from './pages/KakaoRedirectHandler';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Mypage from './pages/Mypage';

import MateList from './pages/MateList'; 
import MateForm from './pages/MateForm';
import MateDetail from './pages/MateDetail';

import ChatList from './pages/ChatList';
import ChatRoom from './pages/ChatRoom';

import Recommend from './pages/Recommend';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({ id: decoded.id, nickname: decoded.nickname});
      } catch (err) {
        console.error('토큰 디코딩 실패', err);
        localStorage.removeItem('token');
      }
    }
  }, []);

  return (
    <Router>
      <Header user={user} setUser={setUser} />
      <Routes>
        {/* 기본 경로 분기 */}
        <Route path="/" element={user ? <Home user={user} /> : <Landing />} />

        {/* 로그인/회원가입 */}
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/signup" element={<SignUp setUser={setUser} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/mypage" element={<Mypage />} />


        {/* 관리자 페이지 */}
        <Route path="/auth/kakao/callback" element={<KakaoRedirectHandler setUser={setUser} />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin" element={<AdminHome user={user} />} />

        {/*여행메이트 게시글*/}
        <Route path="/mate" element={<MateList />} />
        <Route path="/mate/new" element={<MateForm />} />
        <Route path="/mate/:id" element={<MateDetail />} />
        

        {/*내 채팅 */}  
        <Route path="/chat" element={<ChatList />} />
        <Route path="/chat/:id" element={<ChatRoom />} />
        <Route path="/recommend" element={<Recommend />} />


      </Routes>
    </Router>
  );
}

export default App;
