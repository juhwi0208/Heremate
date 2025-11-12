// client/src/components/TrustSummaryCards.js
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function SummaryGrid({ uniquePartners, trips, positiveRatio }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="rounded-2xl">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm text-zinc-500">함께한 메이트</CardTitle>
        </CardHeader>
        <CardContent><div className="text-2xl font-semibold">{uniquePartners}명</div></CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm text-zinc-500">완료한 동행</CardTitle>
        </CardHeader>
        <CardContent><div className="text-2xl font-semibold">{trips}회</div></CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm text-zinc-500">긍정 후기 비율</CardTitle>
        </CardHeader>
        <CardContent><div className="text-2xl font-semibold text-emerald-600">{Math.round((positiveRatio||0)*100)}%</div></CardContent>
      </Card>
    </div>
  );
}

export function TagChips({ tags = [] }) {
  if (!tags.length) return (
    <div className="text-sm text-zinc-500">아직 키워드가 없어요</div>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t,i)=>(
        <span key={`${t}-${i}`} className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
          {t}
        </span>
      ))}
    </div>
  );
}

export function ActivityGrid({ stories=0, activePlans=0, totalPlans=0 }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="rounded-2xl">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm text-zinc-500">작성한 스토리</CardTitle>
        </CardHeader>
        <CardContent><div className="text-2xl font-semibold">{stories}개</div></CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm text-zinc-500">진행중인 계획</CardTitle>
        </CardHeader>
        <CardContent><div className="text-2xl font-semibold">{activePlans}개</div></CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm text-zinc-500">총 여행 계획</CardTitle>
        </CardHeader>
        <CardContent><div className="text-2xl font-semibold">{totalPlans}개</div></CardContent>
      </Card>
    </div>
  );
}
