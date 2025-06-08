import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

function Signup() {
  const location = useLocation();
  const navigate = useNavigate();

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

    // 이메일, 닉네임 직접 입력 유도, 비밀번호는 카카오 로그인 시 안 받아도 됨
    if (!form.email || !form.nickname || (!form.password && !form.kakaoId)) {
      alert('모든 필수 정보를 입력해주세요.');
      return;
    }

    try {
      const res = await axios.post('http://localhost:3001/api/auth/signup', form);
      alert('회원가입 성공! 로그인 후 이용해주세요.');
      navigate('/login');
    } catch (err) {
      console.error('회원가입 오류:', err);
      alert('회원가입에 실패했습니다.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h2>회원가입</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>이메일</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            disabled={!!form.kakaoId && !!form.email}
          />
          {!form.email && (
            <p style={{ color: 'red', fontSize: '0.9rem' }}>
              카카오에서 이메일 정보를 제공하지 않아 직접 입력해주세요.
            </p>
          )}
        </div>

        <div>
          <label>닉네임</label>
          <input
            type="text"
            name="nickname"
            value={form.nickname}
            onChange={handleChange}
            required
          />
          {!form.nickname && (
            <p style={{ color: 'red', fontSize: '0.9rem' }}>
              카카오에서 닉네임 정보를 제공하지 않아 직접 입력해주세요.
            </p>
          )}
        </div>

        {!form.kakaoId && (
          <div>
            <label>비밀번호</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
        )}

        {form.kakaoId && (
          <p style={{ fontSize: '0.9rem', color: 'gray' }}>
            카카오 계정으로 가입 중입니다.
          </p>
        )}

        <button type="submit" style={{ marginTop: '10px' }}>
          회원가입
        </button>
      </form>
    </div>
  );
}

export default Signup;

