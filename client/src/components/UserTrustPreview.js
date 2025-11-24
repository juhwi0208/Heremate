// client/src/components/UserTrustPreview.js
import React from 'react';
import ConstellationCard from './ConstellationCard';

function getAuraGradient(auraColor) {
  switch (auraColor) {
    case 'warm':
      return 'radial-gradient(circle, rgba(250,204,21,0.9) 0%, rgba(250,204,21,0) 70%)';
    case 'cool':
      return 'radial-gradient(circle, rgba(56,189,248,0.9) 0%, rgba(56,189,248,0) 70%)';
    default:
      return 'radial-gradient(circle, rgba(52,211,153,0.9) 0%, rgba(52,211,153,0) 70%)';
  }
}

/**
 * 메이트 상세 / 스토리 상세에서 사용하는 신뢰 정보 요약 카드
 *
 * props는 최대한 유연하게:
 * - nickname / avatarUrl / auraScore / auraLabel / tripCount / positiveRate
 * - 또는 writer, trustSummary 형태로 넘어와도 처리
 */
export default function UserTrustPreview({
  className = '',
  nickname,
  avatarUrl,
  auraScore,
  auraLabel,
  tripCount,
  positiveRate,
  writer,
  trustSummary,
}) {
  // 다양한 형태로 넘어오는 값을 하나로 정리
  const name =
    nickname || writer?.nickname || writer?.name || '사용자';
  const profileImageUrl =
    avatarUrl || writer?.profileImageUrl || writer?.avatarUrl;

  const auraName =
    auraLabel || trustSummary?.auraName || trustSummary?.label || '아우라 산들빛';
  const auraScoreValue =
    auraScore ?? trustSummary?.auraScore ?? trustSummary?.score ?? 50;
  const auraColor = trustSummary?.auraColor;

  const trips =
    tripCount ?? trustSummary?.tripCount ?? 0;
  const positive =
    positiveRate ?? trustSummary?.positiveRate ?? 0;

  return (
    <div
      className={`w-full rounded-2xl bg-[#FFF9E9] px-5 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      {/* 왼쪽: 프로필 + 텍스트 블록 */}
      <div className="flex items-center gap-4 sm:flex-1">
        {/* 아우라 링 */}
        <div className="relative h-14 w-14 shrink-0">
          <div
            className="pointer-events-none absolute inset-[-13px] rounded-full opacity-90"
            style={{ background: getAuraGradient(auraColor) }}
          />
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[2px] border-white bg-gray-100 shadow-md">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[11px] text-gray-500">작성자</span>
            )}
          </div>
        </div>

        {/* 텍스트 */}
        <div className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-800">
          {/* 닉네임 + 점수 뱃지 한 줄 */}
          <div className="flex items-center gap-2">
            <span className="max-w-[120px] truncate text-[15px] font-semibold text-gray-900">
              {name}
            </span>
            <span className="rounded-full bg-[#FFECC2] px-2 py-[2px] text-[11px] font-semibold text-[#D97706]">
              {Math.round(auraScoreValue)}점
            </span>
          </div>

          {/* 아우라 이름 한 줄 */}
          <div className="flex items-center gap-1 text-[11px] text-gray-700">
            <span className="rounded-full bg-white/70 px-2 py-[3px]">
              {auraName}
            </span>
          </div>

          {/* 동행/후기 요약 – 한 줄에 정리 */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600">
            <span>동행 {trips}회</span>
            <span>긍정 후기 {positive}%</span>
          </div>
        </div>
      </div>


      {/* 오른쪽: 작게 줄인 별자리 카드 */}
      <div className="flex flex-1 justify-end">
        <ConstellationCard
          compact
          className="w-[260px]"
          constellation={{
            score: trustSummary?.auraScore ?? 50,
            level: 1,
            nodes: [],
            edges: [],
          }}
        />
      </div>
    </div>
  );
}
