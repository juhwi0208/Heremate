// client/src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import axios from '../api/axiosInstance';

function Login({ setUser }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/auth/login', form);
      const { user, token } = res.data;
      localStorage.setItem('token', token);
      setUser(user);
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.error || '로그인 실패');
    }
  };

  const handleKakaoLogin = () => {
    const REST_API_KEY = '3711275ed6eadb3c397d486504269a15';
    const REDIRECT_URI = 'http://localhost:3000/auth/kakao/callback';
    const kakaoAuthURL = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code`;
    window.location.href = kakaoAuthURL;
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">로그인</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            name="email"
            type="email"
            placeholder="이메일"
            value={form.email}
            onChange={handleChange}
            required
          />
          <Input
            name="password"
            type="password"
            placeholder="비밀번호"
            value={form.password}
            onChange={handleChange}
            required
          />
          <Button type="submit" className="w-full">일반 로그인</Button>
        </form>

        <div className="my-4 text-center text-sm text-gray-500">또는</div>

        <Button
          type="button"
          onClick={handleKakaoLogin}
          className="w-full bg-yellow-300 text-black hover:bg-yellow-400"
        >
          카카오로 로그인
        </Button>

        <div className="mt-6 flex justify-between text-sm text-gray-600">
          <button onClick={() => navigate('/signup')}>회원가입</button>
          <button  onClick={() => navigate('/forgot-password')}>비밀번호 찾기</button>
        </div>
      </div>
    </div>
  );
}

export default Login;
