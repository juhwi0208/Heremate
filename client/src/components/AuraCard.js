// client/src/components/AuraCard.js
import React from 'react';
import { Card, CardContent } from './ui/card'; // ✅ ConstellationCard랑 동일한 경로 규칙 사용

// aura 예시 구조:
// {
//   score: 26,
//   level: 'Lv.2',
//   label: '따뜻한 아우라'
// }
const AuraCard = ({ aura, compact = false }) => {
  // aura가 null일 때 기본값
  const score = aura?.score ?? 0;
  const level = aura?.level ?? 'Lv.1';
  const label = aura?.label ?? '아직 평가가 충분하지 않아요';

  if (compact) {
    // 메이트게시글 카드 안에서 작게 쓰는 버전
    return (
      <div className="flex items-center gap-2 text-xs">
        <div className="relative w-7 h-7 rounded-full bg-gradient-to-tr from-[#FFE6F7] via-[#E0F7FF] to-[#F3FCEB] flex items-center justify-center">
          <span className="text-[11px] font-semibold text-slate-800">
            {score}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-slate-700">
            아우라 {level}
          </span>
          <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
            {label}
          </span>
        </div>
      </div>
    );
  }

  // 프로필/신뢰도 탭에서 사용하는 기본 카드 버전
  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0 flex items-center gap-4">
        {/* 동그란 아우라 아이콘 영역 */}
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-[#FFE6F7] via-[#E0F7FF] to-[#F3FCEB] flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-white/80 flex flex-col items-center justify-center">
            <span className="text-sm font-semibold text-slate-800">
              {score}
            </span>
            <span className="text-[11px] text-slate-500">점</span>
          </div>
        </div>

        {/* 텍스트 영역 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-800">
              나의 아우라 {level}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AuraCard;
