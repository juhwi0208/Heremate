// client/src/pages/SignUp.js
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import axios from '../api/axiosInstance';

export default function SignUp() {
  const location = useLocation();
  const navigate = useNavigate();

  const [emailCheck, setEmailCheck] = useState({ checked: false, valid: false });
  const [emailMsg, setEmailMsg] = useState('');
  const [nickCheck, setNickCheck] = useState({ checked: false, valid: false });
  const [nickMsg, setNickMsg] = useState('');

  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [form, setForm] = useState({
    email: '',
    nickname: '',
    password: '',
    confirm: '',
    kakaoId: null,
  });

  useEffect(() => {
    if (location.state) {
      setForm(prev => ({
        ...prev,
        email: location.state.email || '',
        nickname: location.state.nickname || '',
        kakaoId: location.state.kakaoId || null,
      }));
    }
  }, [location.state]);

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const checkEmailDuplicate = async () => {
    if (!form.email) return setEmailMsg('이메일을 먼저 입력해주세요.');
    try {
      const { data } = await axios.get(`/auth/check-email`, { params: { email: form.email } });
      if (data.exists) {
        setEmailCheck({ checked: true, valid: false });
        setEmailMsg('이미 사용 중인 이메일입니다.');
      } else {
        setEmailCheck({ checked: true, valid: true });
        setEmailMsg('사용 가능한 이메일입니다.');
      }
    } catch {
      setEmailMsg('중복 확인 중 오류 발생');
    }
  };

  const checkNickDuplicate = async () => {
    if (!form.nickname) return setNickMsg('닉네임을 먼저 입력해주세요.');
    try {
      const { data } = await axios.get(`/auth/check-nickname`, { params: { nickname: form.nickname } });
      if (data.exists) {
        setNickCheck({ checked: true, valid: false });
        setNickMsg('이미 사용 중인 닉네임입니다.');
      } else {
        setNickCheck({ checked: true, valid: true });
        setNickMsg('사용 가능한 닉네임입니다.');
      }
    } catch {
      setNickMsg('중복 확인 중 오류 발생');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!emailCheck.checked || !emailCheck.valid) return alert('이메일 중복 확인을 완료해 주세요.');
    if (!nickCheck.checked || !nickCheck.valid) return alert('닉네임 중복 확인을 완료해 주세요.');

    if (!form.kakaoId) {
      if (form.password.length < 8) return alert('비밀번호는 8자 이상이어야 합니다.');
      if (form.password !== form.confirm) return alert('비밀번호가 일치하지 않습니다.');
    }

    try {
      await axios.post('/auth/signup', {
        email: form.email.trim(),
        nickname: form.nickname.trim(),
        password: form.kakaoId ? undefined : form.password,
        kakaoId: form.kakaoId || null,
      });
      alert('가입 완료! 이메일로 인증 메일이 발송되었습니다. 인증 후 로그인해 주세요.');
      navigate('/login');
    } catch (err) {
      const c = err.response?.data?.code;
      if (c === 'EMAIL_TAKEN') return alert('이미 등록된 이메일입니다.');
      if (c === 'NICK_TAKEN') return alert('이미 등록된 닉네임입니다.');
      alert('회원가입 실패');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">회원가입</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700">이메일</label>
            <div className="flex gap-2">
              <Input
                type="email"
                name="email"
                value={form.email}
                onChange={(e) => {
                  onChange(e);
                  setEmailCheck({ checked: false, valid: false });
                  setEmailMsg('');
                }}
                required
                disabled={!!form.kakaoId && !!form.email}
                placeholder="이메일 입력"
              />
              {!form.kakaoId && (
                <Button type="button" onClick={checkEmailDuplicate} className="whitespace-nowrap">중복 확인</Button>
              )}
            </div>
            {emailMsg && (
              <p className={`text-sm mt-1 ${emailCheck.valid ? 'text-green-600' : 'text-red-500'}`}>{emailMsg}</p>
            )}
          </div>

          {/* 닉네임 */}
          <div>
            <label className="block text-sm font-medium text-gray-700">닉네임</label>
            <div className="flex gap-2">
              <Input
                type="text"
                name="nickname"
                value={form.nickname}
                onChange={(e) => {
                  onChange(e);
                  setNickCheck({ checked: false, valid: false });
                  setNickMsg('');
                }}
                required
                placeholder="닉네임 입력"
              />
              <Button type="button" onClick={checkNickDuplicate} className="whitespace-nowrap">중복 확인</Button>
            </div>
            {nickMsg && (
              <p className={`text-sm mt-1 ${nickCheck.valid ? 'text-green-600' : 'text-red-500'}`}>{nickMsg}</p>
            )}
          </div>

          {/* 비밀번호/확인 (카카오 연동이 아닐 때만) */}
          {!form.kakaoId && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">비밀번호 (8자 이상)</label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={onChange}
                    required
                    placeholder="비밀번호 입력"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600"
                    onClick={() => setShowPw((s) => !s)}>{showPw ? '숨김' : '보기'}</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">비밀번호 확인</label>
                <div className="relative">
                  <Input
                    type={showPw2 ? 'text' : 'password'}
                    name="confirm"
                    value={form.confirm}
                    onChange={onChange}
                    required
                    placeholder="비밀번호 재입력"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600"
                    onClick={() => setShowPw2((s) => !s)}>{showPw2 ? '숨김' : '보기'}</button>
                </div>
              </div>
            </>
          )}

          {form.kakaoId && <p className="text-sm text-gray-500">카카오 계정 연동 중입니다.</p>}

          <Button type="submit" className="w-full mt-2">회원가입</Button>
        </form>
      </div>
    </div>
  );
}
