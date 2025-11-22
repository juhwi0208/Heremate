// src/pages/Home.js
// src/pages/Home.js
import React from "react";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ===== Hero Section ===== */}
      <section className="relative h-[420px] md:h-[520px] w-full overflow-hidden">
        {/* 배경 이미지 */}
        <img
          src="/assets/map_preview.jpg"
          alt="여행 이미지"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* 그라데이션 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />

        {/* 중앙 텍스트 + 버튼 */}
        <div className="relative z-10 flex h-full items-center justify-center px-4">
          <div className="text-center text-white max-w-2xl">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4">
              함께 떠나는 여행,
              <br />
              특별한 추억
            </h1>
            <p className="text-sm md:text-base text-zinc-100 mb-8">
              혼자 여행하기 아쉬우셨나요? 나와 잘 맞는 여행 메이트와 함께
              <br className="hidden md:block" />
              더 즐거운 여행을 만들어보세요.
            </p>
            <button
              onClick={() => navigate("/mate")}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-8 py-3 text-sm md:text-base font-semibold shadow-lg hover:bg-emerald-600 transition"
            >
              메이트 찾기 시작하기
            </button>
          </div>
        </div>
      </section>

      {/* ===== Why HereMate ===== */}
      <section className="bg-white py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-center text-2xl md:text-3xl font-semibold text-zinc-900 mb-3">
            왜 HereMate를 선택해야 할까요?
          </h2>
          <p className="text-center text-sm md:text-base text-zinc-500 mb-10">
            안전하고 신뢰할 수 있는 여행 메이트 매칭 서비스로
            <br className="hidden md:block" />
            새로운 여행 경험을 만들어보세요.
          </p>

          <div className="grid gap-10 md:grid-cols-3">
            {/* 기능 1: 안전하고 편리한 매칭 */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <span className="text-emerald-500 text-xl">🛡️</span>
              </div>
              <h3 className="mb-2 text-base md:text-lg font-semibold text-zinc-900">
                안전하고 편리한 매칭
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                검증된 사용자들과 안전하게 연결되고,
                <br />
                나와 잘 맞는 여행 메이트를 쉽게 찾을 수 있어요.
              </p>
            </div>

            {/* 기능 2: 여행 계획 세우기 */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-50">
                <span className="text-sky-500 text-xl">🗺️</span>
              </div>
              <h3 className="mb-2 text-base md:text-lg font-semibold text-zinc-900">
                여행 계획 세우기
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Google Maps 기반 일정 작성 기능으로
                <br />
                여행 동선과 장소 정보를 한 번에 관리할 수 있어요.
              </p>
            </div>

            {/* 기능 3: 스토리 생성 */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-50">
                <span className="text-violet-500 text-xl">📖</span>
              </div>
              <h3 className="mb-2 text-base md:text-lg font-semibold text-zinc-900">
                스토리 생성
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                여행 사진만 올리면 자동으로 여행 스토리를 생성해
                <br />
                나만의 특별한 여행 기록을 손쉽게 남길 수 있어요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 중간 CTA 섹션 ===== */}
      <section className="bg-emerald-500 text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold mb-3">
            지금 바로 여행 메이트를 찾아보세요!
          </h2>
          <p className="text-sm md:text-base text-emerald-50 mb-8">
            새로운 사람들과 함께하는 특별한 여행이 기다리고 있어요.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => navigate("/mate")}
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm md:text-base font-semibold text-emerald-600 shadow hover:bg-emerald-50 transition"
            >
              메이트 찾기
            </button>
            <button
              onClick={() => navigate("/mate/new")}
              className="inline-flex items-center justify-center rounded-full border border-white/80 px-8 py-3 text-sm md:text-base font-semibold text-white hover:bg-emerald-600/10 transition"
            >
              게시글 작성
            </button>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-zinc-900 text-zinc-300 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="mb-2 text-lg font-semibold text-white">HereMate</div>
          <p className="text-xs text-zinc-400 mb-4">
            함께 떠나는 여행, 특별한 추억을 만들어보세요.
          </p>
          <p className="text-[11px] text-zinc-500">
            © {new Date().getFullYear()} HereMate. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
