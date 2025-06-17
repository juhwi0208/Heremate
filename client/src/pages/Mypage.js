// src/pages/Mypage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Mypage = () => {
  const [userInfo, setUserInfo] = useState({ email: '', nickname: '' });
  const [editingNickname, setEditingNickname] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios
      .get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(res => {
        setUserInfo(res.data);
        setEditingNickname(res.data.nickname);
      })
      .catch(err => {
        console.error('사용자 정보 조회 실패:', err);
        alert('로그인이 필요합니다.');
      });
  }, []);

  const handleSave = () => {
    const token = localStorage.getItem('token');
    axios
      .put('/auth/me', { nickname: editingNickname }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => {
        alert('닉네임이 수정되었습니다.');
        setUserInfo(prev => ({ ...prev, nickname: editingNickname }));
      })
      .catch(err => {
        console.error('닉네임 수정 실패:', err);
        alert('닉네임 수정 실패');
      });
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h2 className="text-2xl font-bold mb-6 text-green-700">👤 마이페이지</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">이메일</label>
          <input
            value={userInfo.email}
            readOnly
            className="w-full border px-3 py-2 rounded bg-gray-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">닉네임</label>
          <input
            value={editingNickname}
            onChange={e => setEditingNickname(e.target.value)}
            className="w-full border px-3 py-2 rounded text-sm"
          />
        </div>
        <button
          onClick={handleSave}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
        >
          저장
        </button>
      </div>
    </div>
  );
};

export default Mypage;
