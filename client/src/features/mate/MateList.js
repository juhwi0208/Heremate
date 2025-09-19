// client\src\features\mate\MateList.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axiosInstance';

const MateList = () => {
  const [posts, setPosts] = useState([]);
  const navigate = useNavigate();
  const [location, setLocation] = useState('');
  const [style, setStyle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  

  useEffect(() => {
    axios.get('/api/posts')
      .then(res => setPosts(res.data))
      .catch(err => console.error('게시글 불러오기 실패:', err));
  }, []);

  const handleSearch = () => {
  axios.get('/api/posts', {
    params: { location, style, startDate, endDate },
  })

    .then(res => setPosts(res.data))
    .catch(err => console.error('검색 실패:', err));
};


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
      



      {/* 🔲 필터 박스 전체 */}
      <div className="text-sm border border-gray-200 rounded-xl p-6 mb-4 shadow-sm bg-white">
        <div className="flex flex-wrap items-center gap-4">
          {/* 지역 필터 */}
          <input
            type="text"
            placeholder="지역 (예: 제주)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="border px-3 h-12 rounded w-full md:w-1/6"
          />

          {/* 날짜 필터 */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border px-3 h-12 rounded w-full md:w-1/6"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border px-3 h-12 rounded w-full md:w-1/6"
          />

          {/* 취향 필터 */}
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="border px-3 h-12 rounded w-full md:w-1/6"
          >
            <option value="">여행 스타일 선택</option>
            <option value="자연">자연</option>
            <option value="쇼핑">쇼핑</option>
            <option value="맛집">맛집</option>
            <option value="예술">예술</option>
            <option value="사진">사진</option>
            <option value="축제">축제</option>
            <option value="휴식">휴식</option>
          </select>

          {/* 검색 버튼 */}
          <button
            onClick={handleSearch}
            className="h-12 px-6 bg-blue-500 text-white rounded hover:bg-blue-600 w-full md:w-auto"
          >
            검색
          </button>

          {/* 초기화 버튼 - 같은 라인에 위치 */}
          <button
            onClick={() => {
              setLocation('');
              setStyle('');
              setStartDate('');
              setEndDate('');
              axios.get('/api/posts')
                .then(res => setPosts(res.data))
                .catch(err => console.error('초기화 실패:', err));
            }}
            className="h-6 px-3 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-100 w-full md:w-auto ml-auto"
          >
            필터 초기화
          </button>
        </div>
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
              <p className="text-xs text-gray-400 mt-2">
                {post.start_date?.slice(5)} ~ {post.end_date?.slice(5)} | {post.location}
              </p>
              <p className="text-xs text-gray-500 mt-1">작성자: {post.nickname}</p> 
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MateList;
