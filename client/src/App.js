// client/src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode'; 


import Header from './components/Header';
import Home from './pages/Home';
import SignUp from './pages/SignUp';
import KakaoRedirectHandler from './pages/KakaoRedirectHandler';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({ id: decoded.id, nickname: decoded.nickname });
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
        <Route path="/" element={<Home />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/signup" element={<SignUp setUser={setUser} />} />
        <Route path="/auth/kakao/callback" element={<KakaoRedirectHandler setUser={setUser} />} />
      </Routes>
    </Router>
  );
}

export default App;
