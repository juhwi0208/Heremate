//C:\Users\owner\Documents\GitHub\Heremate\client\src\pages\SignUp.js
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import axios from 'axios';

function SignUp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [emailCheck, setEmailCheck] = useState({ checked: false, valid: false });
  const [emailMsg, setEmailMsg] = useState('');
  const [form, setForm] = useState({
    email: '',
    nickname: '',
    password: '',
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

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.nickname || (!form.password && !form.kakaoId)) {
      alert('모든 필수 정보를 입력해주세요.');
      return;
    }

    if (!emailCheck.checked || !emailCheck.valid) {
      alert('이메일 중복 확인을 먼저 완료해주세요.');
      return;
    } 

    try {
      const res = await axios.post('http://localhost:4000/auth/signup', form);
      console.log('회원가입 응답:', res.data);
      alert('회원가입 성공! 로그인 후 이용해주세요.');
      navigate('/login');
    } catch (err) {
      console.error('회원가입 오류:', err);
      alert('회원가입에 실패했습니다.');
    }
  };

  const checkEmailDuplicate = async () => {
    if (!form.email) {
      setEmailMsg('이메일을 먼저 입력해주세요.');
      return;
    }

    try {
      const res = await axios.get(`http://localhost:4000/auth/check-email?email=${form.email}`);
      if (res.data.exists) {
        setEmailCheck({ checked: true, valid: false });
        setEmailMsg('이미 사용 중인 이메일입니다.');
      } else {
        setEmailCheck({ checked: true, valid: true });
        setEmailMsg('사용 가능한 이메일입니다.');
      }

    } catch (err) {
      setEmailMsg('중복 확인 중 오류 발생');
      console.error(err);
    }
  };


  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">회원가입</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700">이메일</label>
            <div className="flex gap-2">
            <Input
              type="email"
              name="email"
              value={form.email}
              onChange={(e) => {
                handleChange(e);
                setEmailCheck({ checked: false, valid: false }); // 이메일 바뀌면 초기화
                setEmailMsg('');
              }}
              required
              disabled={!!form.kakaoId && !!form.email}
              placeholder="이메일 입력"
            />
            {!form.kakaoId && (
              <Button type="button" onClick={checkEmailDuplicate} className="whitespace-nowrap">
                중복 확인
              </Button>
            )}
          </div>

          {emailMsg && (
            <p className={`text-sm mt-1 ${emailCheck.valid ? 'text-green-600' : 'text-red-500'}`}>
              {emailMsg}
            </p>
          )}
        </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">닉네임</label>
            <Input
              type="text"
              name="nickname"
              value={form.nickname}
              onChange={handleChange}
              required
              placeholder="닉네임 입력"
            />
            
          </div>

          
        

          {!form.kakaoId && (
            <div>
              <label className="block text-sm font-medium text-gray-700">비밀번호</label>
              <Input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="비밀번호 입력"
              />
            </div>
          )}

          {form.kakaoId && (
            <p className="text-sm text-gray-500">카카오 계정 연동 중입니다.</p>
          )}

          <Button type="submit" className="w-full mt-2">
            회원가입
          </Button>
        </form>
      </div>
    </div>
  );
}

export default SignUp;


