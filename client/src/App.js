// src/pages/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import KakaoCallback from './pages/KakaoCallback';
import Home from './pages/Home';
import Signup from './pages/Signup';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />               {/* 홈 */}
        <Route path="/signup" element={<Signup />} />       {/* 회원가입 */}
        <Route path="/login" element={<Login />} />         {/* 로그인 페이지 */}
        <Route path="/kakao/callback" element={<KakaoCallback />} />
        <Route path="/home" element={<div>로그인 완료! 홈입니다.</div>} />  {/* 로그인 후 이동 */}
      </Routes>
    </Router>
  );
}

export default App;
