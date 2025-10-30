//client\src\features\plan\PlanList\SharedPlanCard.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin } from 'lucide-react';

const diffDays = (s, e) => {
  if (!s || !e) return { days: 0, nights: 0 };
  const a = new Date(s);
  const b = new Date(e);
  const days = Math.max(1, Math.round((b - a) / 86400000) + 1);
  return { days, nights: Math.max(0, days - 1) };
};

const tagTone = (t) => {
  // 취향 키워드에 따른 색상 톤 매핑
  const k = String(t || '').toLowerCase();
  if (/(도시|city|urban)/.test(k))      return 'bg-indigo-100 text-indigo-700';
  if (/(자연|nature)/.test(k))         return 'bg-emerald-100 text-emerald-700';
  if (/(맛집|food|eat|gastronomy)/.test(k)) return 'bg-amber-100 text-amber-700';
  if (/(쇼핑|shopping)/.test(k))       return 'bg-pink-100 text-pink-700';
  if (/(역사|history)/.test(k))        return 'bg-sky-100 text-sky-700';
  if (/(휴양|relax)/.test(k))          return 'bg-teal-100 text-teal-700';
  // 기본
  return 'bg-zinc-100 text-zinc-700';
};

export default function SharedPlanCard({ plan }) {
  const nav = useNavigate();
  const { days, nights } = diffDays(plan.start_date, plan.end_date);
  const thumb = plan.thumbnail_url || '/assets/default_plan.jpg';

  // prefs: string(json) | string[] | undefined
  const tags = React.useMemo(() => {
    if (Array.isArray(plan.prefs)) return plan.prefs;
    if (typeof plan.prefs === 'string') {
      try { return JSON.parse(plan.prefs) || []; } catch { return []; }
    }
    return [];
  }, [plan.prefs]);

  const onOpen = () => nav(`/plans/${plan.id}/readonly`);

  return (
    <div
      onClick={onOpen}
      className="group cursor-pointer bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      {/* 썸네일 */}
      <div className="relative h-44 w-full overflow-hidden">
        <img
          src={thumb}
          alt=""
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {days > 0 && (
          <div className="absolute top-2 right-2 text-[11px] bg-black/65 text-white px-2 py-1 rounded-full backdrop-blur">
            {nights}박 {days}일
          </div>
        )}
      </div>

      {/* 본문 */}
      <div className="p-4">
        {/* 제목 / 날짜 */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-zinc-900 truncate">{plan.title || '제목 없음'}</h3>
          <span className="text-[12px] text-zinc-500 whitespace-nowrap">
            {plan.start_date?.slice(0,10)} ~ {plan.end_date?.slice(0,10)}
          </span>
        </div>

        {/* 지역 */}
        <div className="mt-1 text-sm text-zinc-600 flex items-center gap-1">
          <MapPin className="w-4 h-4" />
          <span className="truncate">
            {plan.country || '—'} · {plan.region || '—'}
          </span>
        </div>

        {/* 설명(있으면) */}
        {plan.description ? (
          <div className="mt-1 text-[13px] text-zinc-600 line-clamp-1">
            {plan.description}
          </div>
        ) : null}

        {/* 취향 칩 */}
        {!!tags.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full ${tagTone(t)}`}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


