import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import KakaoCallback from './pages/KakaoCallback';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/oauth/kakao/callback" element={<KakaoCallback />} />
        <Route path="/" element={<div>홈 페이지입니다. 로그인 성공 시 이동됩니다.</div>} />
      </Routes>
    </Router>
  );
}

export default App;

