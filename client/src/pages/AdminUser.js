// src/pages/AdminUsers.js
import React, { useEffect, useState } from 'react';
import axios from '../api/axiosInstance';

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('로그인된 관리자만 접근할 수 있습니다.');
      setLoading(false);
      return;
    }

    axios.get('http://localhost:4000/admin/users')
    .then((res) => {
        const filtered = res.data.filter(user => user.role !== 'admin');
        setUsers(filtered);
        setLoading(false);
    })
    .catch((err) => {
        setError('회원 목록을 불러오는 데 실패했습니다.');
        setLoading(false);
    });
  };

   const handleDelete = async (id) => {
    if (!window.confirm('정말로 삭제하시겠습니까?')) return;
    try {
     await axios.delete(`http://localhost:4000/admin/users/${id}`);
      fetchUsers(); // 삭제 후 목록 갱신
    } catch (err) {
      alert('삭제에 실패했습니다.');
    }
  };

  if (loading) return <div className="p-4">불러오는 중...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">회원 목록</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-4 py-2">ID</th>
              <th className="border px-4 py-2">이메일</th>
              <th className="border px-4 py-2">닉네임</th>
              <th className="border px-4 py-2">권한</th>
              <th className="border px-4 py-2">가입일</th>
              <th className="border px-4 py-2">삭제</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="border px-4 py-2 text-center">{user.id}</td>
                <td className="border px-4 py-2">{user.email}</td>
                <td className="border px-4 py-2">{user.nickname}</td>
                <td className="border px-4 py-2 text-center">{user.role}</td>
                <td className="border px-4 py-2">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="border px-4 py-2 text-center">
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminUsers;
