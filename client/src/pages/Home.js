// src/pages/Home.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section */}
      <section className="flex flex-col md:flex-row items-center justify-between px-6 md:px-20 py-16 bg-[#F3FCEB]">
        <div className="text-left mb-8 md:mb-0 md:w-1/2">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            나의 위치에서 취향에 맞는 관광지를 추천받아보세요!
          </h1>
          <ul className="text-gray-600 mb-4 list-disc pl-5 text-sm">
            <li>취향별 관광명소 보기</li>
            <li>위치별 관광명소 보기</li>
            <li>관광지 순위별 보기</li>
          </ul>
          <button
            onClick={() => navigate('/recommend')}
            className="bg-[#90D744] text-white font-semibold px-5 py-2 rounded hover:bg-[#7cc634]"
          >
            나의 위치에서 관광지 추천받기
          </button>
        </div>
        <div className="md:w-1/2">
          <img
            src="/assets/map_preview.jpg"
            alt="지도 미리보기"
            className="rounded-xl shadow-md w-full"
          />
        </div>
      </section>

      {/* 여행 메이트 게시글 */}
      <section className="py-10 px-6 md:px-20">
        <h2 className="text-2xl font-bold mb-8">여행 메이트 게시글</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 이 부분은 추후 map(post => ...)으로 대체 */}
          <div className="p-4 rounded-xl bg-white shadow">오사카 여행 메이트 구합니다!</div>
          <div className="p-4 rounded-xl bg-[#DDF3D9] shadow">LA 디즈니 랜드 동행 구해요.</div>
          <div className="p-4 rounded-xl bg-white shadow">뉴욕 여행 같이 여행하실 분!</div>
          <div className="p-4 rounded-xl bg-white shadow">제주도 여행 메이트 구해요.</div>
        </div>
      </section>

      {/* 여행 계획 */}
      <section className="bg-[#E2F6CB] py-16 px-6 md:px-20">
        <h2 className="text-2xl font-bold mb-8">여행 계획</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 추후 map으로 대체 */}
          <div className="border rounded-xl p-4">
            <h3 className="text-lg font-semibold mb-2 text-[#009C89]">일본 오사카<br />25.01.23 ~ 25.01.28</h3>
            <ul className="text-sm text-gray-600">
              <li>⧠ 맛집 둘러보기</li>
              <li>⧠ 유니버설 스튜디오</li>
              <li>⧠ 오사카 성 야경</li>
              <li>⧠ 신세카이 관광</li>
            </ul>
          </div>
          <div className="border rounded-xl p-4">
            <h3 className="text-lg font-semibold mb-2 text-[#009C89]">캐나다 밴프<br />25.05.20 ~ 25.06.05</h3>
            <ul className="text-sm text-gray-600">
              <li>⧠ 레이크 루이스</li>
              <li>⧠ 캐나다 로키산맥</li>
              <li>⧠ 밴프 국립공원 탐험</li>
              <li>⧠ 아이스필드</li>
              <li>⧠ 보우폭포</li>
            </ul>
          </div>
          <div className="border rounded-xl p-4">
            <h3 className="text-lg font-semibold mb-2 text-[#009C89]">대만 타이베이<br />25.04.23 ~ 25.04.28</h3>
            <ul className="text-sm text-gray-600">
              <li>⧠ 타이베이 101 타워</li>
              <li>⧠ 단수이</li>
              <li>⧠ 스린 야시장</li>
              <li>⧠ 고궁박물관</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 여행 스토리 */}
      <section className="py-16 px-6 md:px-20">
        <h2 className="text-2xl font-bold mb-8">여행 스토리</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <img src="/assets/story1.jpg" alt="스토리1" className="rounded-xl" />
            <p className="mt-2 text-sm text-gray-600">25.01.23 ~ 25.01.28 일본 삿포로</p>
          </div>
          <div>
            <img src="/assets/story2.jpg" alt="스토리2" className="rounded-xl" />
            <p className="mt-2 text-sm text-gray-600">25.01.23 ~ 25.01.28 캐나다 밴프</p>
          </div>
          <div>
            <img src="/assets/story3.jpg" alt="스토리3" className="rounded-xl" />
            <p className="mt-2 text-sm text-gray-600">25.04.23 ~ 25.01.28 대만 타이베이</p>
          </div>
        </div>
      </section>

      
    </div>
  );
};

export default Home;
