//C:\Users\owner\Documents\GitHub\Heremate\client\src\pages\MateDetail.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const MateDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    axios.get(`/api/posts/${id}`).then(res => setPost(res.data));

    const token = localStorage.getItem('token');
    if (token) {
      axios.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
        .then(res => setUserId(res.data.id))
        .catch(() => setUserId(null));
    }
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`/api/posts/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert('삭제 완료');
      navigate('/mate');
    } catch {
      alert('삭제 실패');
    }
  };

  if (!post) return <div className="p-6">불러오는 중...</div>;

  return (
  <div className="max-w-3xl mx-auto px-6 pt-12 pb-20 text-gray-800">
    
    {/* ✅ 게시글 전체를 감싸는 검은 실선 네모 박스 */}
    <div className="border border-black rounded-md p-6">

      {/* 제목 + 삭제 */}
      <div className="flex justify-between items-start mb-2">
        <h1 className="text-3xl font-bold">{post.title}</h1>
        {userId === post.writer_id && (
          <button
            onClick={handleDelete}
            className="text-xs text-red-500 hover:text-red-700"
          >
            삭제
          </button>
        )}
      </div>

      {/* 날짜 + 스타일 */}
      <div className="text-sm text-gray-600 mb-6 border-b pb-2">
        <p>📅 날짜: {post.travel_date?.split('T')[0]}</p>
        <p>🎒 여행 스타일: {post.travel_style || '기타'}</p>
      </div>

      {/* 본문 + 버튼 한 박스에 */}
      <div className="bg-gray-100 rounded-xl p-6 shadow-sm border">
        <div className="whitespace-pre-wrap leading-relaxed text-base mb-6">
          {post.content}
        </div>
        <div className="flex justify-end">
          <button className="bg-lime-300 hover:bg-lime-400 text-black text-sm font-medium px-6 py-3 rounded-full shadow">
            💬 채팅 시작하기
          </button>
        </div>
      </div>

    </div>
  </div>
);
}

export default MateDetail;
