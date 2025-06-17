// src/pages/Landing.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Hero Section */}
      <section className="bg-[#FAFAFA] py-20 text-center px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
          여행, 누군가와 함께라면 더 즐거우니까
        </h1>
        <p className="text-gray-600 mb-8 text-lg">
          HereMate와 함께 여행 메이트를 찾아보세요
        </p>
        <button
          onClick={() => navigate('/login')}
          className="bg-blue-600 text-white text-sm font-semibold px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition"
        >
          로그인하고 시작하기
        </button>
      </section>

      {/* 서비스 소개 카드 */}
      <section className="py-16 bg-white px-6 md:px-20">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-12">HereMate에서 가능한 일들</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="border rounded-lg p-6 shadow hover:shadow-md transition">
            <h3 className="text-xl font-semibold mb-2">1. 원하는 관광지 추천</h3>
            <p className="text-sm text-gray-600 mb-4">
              현재 위치 기반 혹은 키워드로 관광지를 추천받고, 인기 명소를 빠르게 확인할 수 있어요.
            </p>
            <button
              onClick={() => navigate('/recommend')}
              className="text-blue-600 text-sm font-medium hover:underline"
            >
              추천 받기 →
            </button>
          </div>
          <div className="border rounded-lg p-6 shadow hover:shadow-md transition">
            <h3 className="text-xl font-semibold mb-2">2. 여행 계획 저장</h3>
            <p className="text-sm text-gray-600 mb-4">
              여행 날짜와 장소를 직접 입력하고, 메모도 추가해서 나만의 여행 일정을 저장해 보세요.
            </p>
            <button
              onClick={() => navigate('/plans')}
              className="text-blue-600 text-sm font-medium hover:underline"
            >
              여행 계획 세우기 →
            </button>
          </div>
          <div className="border rounded-lg p-6 shadow hover:shadow-md transition">
            <h3 className="text-xl font-semibold mb-2">3. 여행 스토리 공유</h3>
            <p className="text-sm text-gray-600 mb-4">
              사진과 함께 여행 이야기를 기록하고 공유할 수 있어요. 추억을 남겨보세요!
            </p>
            <button
              onClick={() => navigate('/stories')}
              className="text-blue-600 text-sm font-medium hover:underline"
            >
              스토리 작성하기 →
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Landing;

