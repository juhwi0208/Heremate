// client/src/pages/ForgotPassword.js
import React, { useState } from 'react';
import axios from '../api/axiosInstance';

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const sendCode = async (e) => {
    e.preventDefault();
    await axios.post('/auth/forgot', { email: email.trim() });
    alert('인증 코드를 이메일로 보냈습니다. 메일함을 확인하세요.');
    setStep(2);
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/auth/verify-reset', { email: email.trim(), code: code.trim() });
      setStep(3);
    } catch (err) {
      alert(err.response?.data?.error || '인증 코드가 올바르지 않습니다.');
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return alert('비밀번호는 8자 이상이어야 합니다.');
    if (pw !== pw2) return alert('비밀번호가 일치하지 않습니다.');
    try {
      await axios.post('/auth/update-password', { email: email.trim(), code: code.trim(), password: pw });
      alert('비밀번호가 변경되었습니다. 다시 로그인해 주세요.');
      window.location.href = '/login';
    } catch (err) {
      alert(err.response?.data?.error || '변경 실패');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md">
      <h2 className="text-xl font-semibold mb-4">비밀번호 찾기</h2>

      {step === 1 && (
        <form onSubmit={sendCode} className="space-y-4">
          <input
            type="email"
            placeholder="가입한 이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded p-2"
            required
          />
          <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded">인증 코드 보내기</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={verifyCode} className="space-y-4">
          <div className="text-sm text-gray-600">이메일: {email}</div>
          <input
            type="text"
            placeholder="이메일로 받은 6자리 코드"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full border rounded p-2"
            required
          />
          <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded">코드 확인</button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={updatePassword} className="space-y-4">
          <div className="text-sm text-gray-600">이메일: {email}</div>

          <div className="relative">
            <input
              type={show1 ? 'text' : 'password'}
              placeholder="새 비밀번호 (8자 이상)"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-full border rounded p-2 pr-12"
              required
            />
            <button type="button" onClick={() => setShow1((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600">
              {show1 ? '숨김' : '보기'}
            </button>
          </div>

          <div className="relative">
            <input
              type={show2 ? 'text' : 'password'}
              placeholder="새 비밀번호 재입력"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="w-full border rounded p-2 pr-12"
              required
            />
            <button type="button" onClick={() => setShow2((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600">
              {show2 ? '숨김' : '보기'}
            </button>
          </div>

          <button type="submit" className="w-full bg-green-600 text-white py-2 rounded">변경</button>
        </form>
      )}
    </div>
  );
}
