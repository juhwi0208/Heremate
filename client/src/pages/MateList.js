// src/pages/MateList.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const MateList = () => {
  const [posts, setPosts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/posts')
      .then(res => setPosts(res.data))
      .catch(err => console.error('게시글 불러오기 실패:', err));
  }, []);

  return (
    <div className="min-h-screen bg-white px-6 md:px-20 py-12">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">여행 메이트 모집글</h2>
        <button
          onClick={() => navigate('/mate/new')}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm"
        >
          + 새 글 작성
        </button>
      </div>

      {posts.length === 0 ? (
        <p className="text-gray-500 text-sm">등록된 게시글이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map(post => (
            <div
              key={post.id}
              onClick={() => navigate(`/mate/${post.id}`)}
              className="p-4 rounded-xl shadow bg-white hover:shadow-lg cursor-pointer transition"
            >
              <h3 className="text-lg font-semibold mb-2 text-green-700">{post.title}</h3>
              <p className="text-sm text-gray-600">{post.content?.slice(0, 60)}...</p>
              <p className="text-xs text-gray-400 mt-2">{post.travel_date} | {post.location}</p>
              <p className="text-xs text-gray-500 mt-1">작성자: {post.nickname}</p> 
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MateList;
