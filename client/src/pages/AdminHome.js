// src/pages/AdminHome.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

const AdminHome = ({ user }) => {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">관리자 페이지</h1>

      <p className="mb-4">관리자 기능을 선택하세요.</p>

      <button
        onClick={() => navigate('/admin/users')}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        회원 목록 조회
      </button>
    </div>
  );
};

export default AdminHome;
