// client/src/components/TrustSummaryCards.js
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

// 신뢰 지표 요약 카드
export function SummaryGrid({ aura, reviewCount, positivePercent }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-zinc-500">
            아우라 점수
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-zinc-900">
            {aura?.score ?? 0}점
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {aura?.label || '아직 데이터가 충분하지 않아요'}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-zinc-500">
            받은 후기
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-zinc-900">
            {reviewCount ?? 0}개
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            동행 후 남긴 실제 이용자 후기 수
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-zinc-500">
            긍정 후기 비율
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-zinc-900">
            {positivePercent ?? 0}%
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            좋은 평가를 받은 여행의 비율
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 후기 키워드 칩
export function TagChips({ tags }) {
  if (!tags || !tags.length) {
    return (
      <div className="rounded-2xl border bg-white px-6 py-5 text-sm text-zinc-500 shadow-sm">
        아직 누적된 후기 키워드가 없어요.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white px-6 py-5 shadow-sm">
      <div className="mb-3 text-sm font-medium text-zinc-900">
        이런 점이 좋았어요
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <Badge
            key={t.name}
            className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-normal text-zinc-700 hover:bg-zinc-100"
          >
            {t.name} · {t.count}회
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ✅ 활동 현황 카드 (여행 스토리 / 여행계획 / 메이트 글)
export function ActivityGrid({
  stories = 0,
  activePlans = 0,
  totalPlans = 0,
  posts = 0,
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-zinc-500">
            여행 스토리
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-zinc-900">
            {stories}개
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-zinc-500">
            진행 중인 여행계획
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-zinc-900">
            {activePlans}개
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-zinc-500">
            전체 여행계획
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-zinc-900">
            {totalPlans}개
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-zinc-500">
            작성한 메이트 글
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-zinc-900">
            {posts}개
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
