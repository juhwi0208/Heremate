// client/src/features/mate/components/UserTrustPreview.js

import React from "react";
import ConstellationCard from "./ConstellationCard";

function getAuraGradient(auraColor) {
  // auraColor 값이 있으면 색을 살짝 바꾸고, 없으면 기본 민트/노랑 느낌
  switch (auraColor) {
    case "warm":
      return "radial-gradient(circle, rgba(250,204,21,0.9) 0%, rgba(250,204,21,0) 70%)";
    case "cool":
      return "radial-gradient(circle, rgba(56,189,248,0.9) 0%, rgba(56,189,248,0) 70%)";
    default:
      return "radial-gradient(circle, rgba(52,211,153,0.9) 0%, rgba(52,211,153,0) 70%)";
  }
}

/**
 * 메이트 상세 / 스토리 상세에서 공통으로 보여줄 신뢰정보 카드
 *
 * props 예시:
 * - writer: {
 *     nickname: "사용자2",
 *     profileImageUrl: "...",
 *   }
 * - trustSummary: {
 *     auraName: "아우라 산들빛",
 *     auraScore: 50,
 *     auraColor: "warm",
 *     tripCount: 0,
 *     positiveRate: 0,
 *   }
 */
const UserTrustPreview = ({ writer, trustSummary }) => {
  const nickname = writer?.nickname || "사용자";
  const profileImageUrl = writer?.profileImageUrl;

  const auraName = trustSummary?.auraName || "아우라 산들빛";
  const auraScore = trustSummary?.auraScore ?? 50;
  const auraColor = trustSummary?.auraColor;
  const tripCount = trustSummary?.tripCount ?? 0;
  const positiveRate = trustSummary?.positiveRate ?? 0;

  return (
    <div className="flex w-full items-center gap-8 rounded-[32px] bg-[#FFF9E9] px-8 py-6">
      {/* 왼쪽 : 프로필 + 텍스트 정보 */}
      <div className="flex flex-1 items-center gap-6">
        {/* 아우라가 프로필 주변에만 도는 그라데이션 링 */}
        <div className="relative h-16 w-16">
          {/* 아우라 링 – 바깥으로 갈수록 투명해지는 radial-gradient */}
          <div
            className="pointer-events-none absolute inset-[-10px] rounded-full opacity-90"
            style={{ background: getAuraGradient(auraColor) }}
          />
          {/* 실제 프로필 이미지 */}
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-gray-100 shadow-md">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={nickname}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs text-gray-500">작성자</span>
            )}
          </div>
        </div>

        {/* 텍스트 블록 */}
        <div className="flex flex-col gap-1 text-sm text-gray-800">
          {/* 닉네임 + 총 점수 뱃지 */}
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-900">
              {nickname}
            </span>
            <span className="rounded-full bg-[#FFECC2] px-2 py-0.5 text-[11px] font-semibold text-[#D97706]">
              {auraScore}점
            </span>
          </div>

          {/* 아우라 이름 + 점수 */}
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <span className="rounded-full bg-gray-200 px-3 py-1 text-[11px] text-gray-700">
              {auraName}
            </span>
            <span className="text-xs font-medium text-gray-700">
              {auraScore}점
            </span>
          </div>

          {/* 동행 횟수 / 유니크 파트너 제거 */}
          <div className="flex gap-3 text-xs text-gray-600">
            <span>동행 {tripCount}회</span>
          </div>

          {/* 긍정 후기 비율 */}
          <div className="text-xs text-gray-600">
            긍정 후기 {positiveRate}%
          </div>
        </div>
      </div>

      {/* 오른쪽 : 별자리 카드 */}
      <div className="flex flex-1 justify-end">
        {/* 별자리 잘리지 않도록 고정 비율 + 배경 흰색 제거 */}
        <div className="w-[260px] max-w-full">
          <div className="rounded-[24px] shadow-md">
            {/* ConstellationCard 안에서 배경까지 그리게 하고, 여기서는 여백/흰배경을 넣지 않음 */}
            <ConstellationCard compact />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserTrustPreview;
