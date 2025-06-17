// src/pages/MateDetail.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const MateDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);

  useEffect(() => {
    axios.get(`/api/posts/${id}`)
      .then(res => setPost(res.data))
      .catch(err => {
        console.error('게시글 불러오기 실패:', err);
        alert('게시글을 불러오는 데 실패했습니다.');
      });
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/posts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('삭제되었습니다.');
      navigate('/mate');
    } catch (err) {
      console.error('삭제 실패:', err);
      alert('삭제 실패');
    }
  };

  if (!post) return <p className="p-6">로딩 중...</p>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-4 text-green-700">{post.title}</h1>
      <div className="text-sm text-gray-500 mb-2">👤 작성자: {post.nickname}</div>

      <p className="text-gray-700 mb-2 whitespace-pre-wrap">{post.content}</p>
      <div className="text-sm text-gray-500 mt-4 space-y-1">
        <div>여행 날짜: {post.travel_date || '미정'}</div>
        <div>지역: {post.location || '미정'}</div>
        <div>작성일: {new Date(post.created_at).toLocaleDateString()}</div>
      </div>

      <div className="mt-6 flex gap-4">
        <button
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          onClick={handleDelete}
        >
          삭제하기
        </button>
        {/* 선택: 나중에 수정 기능 추가 시 여기 */}
        {/* <button
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          onClick={() => navigate(`/mate/${id}/edit`)}
        >
          수정하기
        </button> */}
      </div>
    </div>
  );
};

export default MateDetail;
