import React, { useState } from 'react';
import axios from '../api/axiosInstance';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setTempPassword(null);

    try {
      const res = await axios.post('http://localhost:4000/auth/reset-password', { email });
      setTempPassword(res.data.tempPassword);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || '오류 발생');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md">
      <h2 className="text-xl font-semibold mb-4">비밀번호 찾기</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="가입한 이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded p-2"
          required
        />
        <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded">
          임시 비밀번호 발급
        </button>
      </form>

      {tempPassword && (
        <div className="mt-4 text-green-600">
          ✅ 임시 비밀번호: <strong>{tempPassword}</strong>
        </div>
      )}
      {error && <p className="mt-2 text-red-500">{error}</p>}
    </div>
  );
}

export default ForgotPassword;
