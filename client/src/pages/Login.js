// client/src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import axios from '../api/axiosInstance';

export default function Login({ setUser }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [needVerify, setNeedVerify] = useState(false);
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post('/auth/login', form);
      localStorage.setItem('token', data.token);
      setUser && setUser(data.user);
      navigate('/');
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setNeedVerify(true);
      } else {
        alert(err.response?.data?.error || '로그인 실패');
      }
    }
  };

  const resendVerify = async () => {
    try {
      setSending(true);
      await axios.post('/auth/resend-verify', { email: form.email });
      alert('인증 메일을 다시 보냈습니다.');
    } catch {
      alert('재발송 실패');
    } finally {
      setSending(false);
    }
  };

  const handleKakaoLogin = () => {
    const REST_API_KEY = import.meta.env?.VITE_KAKAO_REST_API_KEY
                      || process.env.REACT_APP_KAKAO_REST_API_KEY
                      || '3711275ed6eadb3c397d486504269a15'; // .env 값 권장
    const REDIRECT_URI =
      import.meta.env?.VITE_KAKAO_REDIRECT_URI
      || process.env.REACT_APP_KAKAO_REDIRECT_URI
      || 'http://localhost:3000/auth/kakao/callback';

    const url = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;
    window.location.href = url;
  };
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">로그인</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            name="email"
            type="email"
            placeholder="이메일"
            value={form.email}
            onChange={onChange}
            required
          />
          <div className="relative">
            <Input
              name="password"
              type={showPw ? 'text' : 'password'}
              placeholder="비밀번호"
              value={form.password}
              onChange={onChange}
              required
              className="pr-10"
            />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600"
              onClick={() => setShowPw((s) => !s)}>{showPw ? '숨김' : '보기'}</button>
          </div>

          {needVerify && (
            <div className="p-3 border rounded text-sm">
              이메일 인증이 필요합니다.
              <div className="mt-2">
                <Button type="button" onClick={resendVerify} disabled={sending}>
                  {sending ? '발송 중…' : '인증 메일 재발송'}
                </Button>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full">일반 로그인</Button>
        </form>

        <div className="my-4 text-center text-sm text-gray-500">또는</div>

        <Button type="button" onClick={handleKakaoLogin} className="w-full bg-yellow-300 text-black hover:bg-yellow-400">
          카카오로 로그인
        </Button>

        <div className="mt-6 flex justify-between text-sm text-gray-600">
          <button onClick={() => navigate('/signup')}>회원가입</button>
          <button onClick={() => navigate('/forgot-password')}>비밀번호 찾기</button>
        </div>
      </div>
    </div>
  );
}
