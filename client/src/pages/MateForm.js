// src/pages/MateForm.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const MateForm = () => {
  const [form, setForm] = useState({
    title: '',
    content: '',
    travel_date: '',
    location: '',
  });
  const navigate = useNavigate();

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      console.log('token:', token);
      await axios.post('/api/posts', form, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      navigate('/mate');
    } catch (err) {
      console.error('게시글 작성 실패:', err);
      alert('작성 실패: 로그인 상태 확인 또는 입력값 확인');
    }
    
  };
  
  
  return (
    <div className="max-w-2xl mx-auto mt-10 px-6">
      <h2 className="text-2xl font-bold mb-6">여행 메이트 모집글 작성</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="title"
          placeholder="제목"
          value={form.title}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
          required
        />
        <textarea
          name="content"
          placeholder="내용"
          value={form.content}
          onChange={handleChange}
          rows={5}
          className="w-full border px-3 py-2 rounded"
        />
        <input
          type="date"
          name="travel_date"
          value={form.travel_date}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        />
        <input
          type="text"
          name="location"
          placeholder="여행 지역 (예: 제주도, 오사카)"
          value={form.location}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        />
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          등록하기
        </button>
      </form>
    </div>
  );
};

export default MateForm;
