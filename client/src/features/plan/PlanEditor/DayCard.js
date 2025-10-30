// src/features/plan/PlanEditor/DayCard.js
import React, { useState } from 'react';

const times30m = Array.from({ length: 48 }, (_, i) => {
  const hh = String(Math.floor(i / 2)).padStart(2, '0');
  const mm = i % 2 ? '30' : '00';
  return `${hh}:${mm}`;
});

function isWithinOpening(openingHours, dateStr, timeStr) {
  if (!openingHours?.periods?.length || !dateStr || !timeStr) return true;
  const t = Number((timeStr || '').replace(':', '') || 0);
  const wd = new Date(dateStr).getDay();
  const slots = [];
  for (const p of openingHours.periods) {
    const od = p.open?.day;
    const cd = p.close?.day ?? od;
    const ot = Number(p.open?.time || '0000');
    const ct = Number(p.close?.time || '2400');
    if (od === wd && cd === wd) slots.push([ot, ct]);
  }
  if (!slots.length) return true;
  return slots.some(([a, b]) => a <= t && t < b);
}

// 공통 아이콘(SVG)
const TrashIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M3 6h18" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M8 6l1-2h6l1 2" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 6l1 14h10l1-14" stroke="#DC2626" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M10 10v6M14 10v6" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const MarkerOutlineIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" stroke="#475569" strokeWidth="1.8" />
    <circle cx="12" cy="10" r="2.5" stroke="#475569" strokeWidth="1.5" fill="none" />
  </svg>
);

export default function DayCard({
  day, index, isReadonly,
  onDayDragOver, onDayDrop, addEntry, updateEntry,
  removeEntry, moveEntryUpDown, onDragStart,
  selectedEntryId, setSelectedEntryId,
  setDays, showOnMap
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [newTime, setNewTime] = useState('09:00');
  const [newTitle, setNewTitle] = useState('');
  const [newAddr, setNewAddr] = useState('');

  const onAdd = () => {
    const id = addEntry();
    updateEntry(id, { time: newTime, title: newTitle, address: newAddr });
    setSelectedEntryId(id);
    setAddOpen(false);
    setNewTitle('');
    setNewAddr('');
  };

  return (
    <div onDragOver={onDayDragOver(index)} onDrop={onDayDrop(index)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold">Day {index + 1} <span className="text-xs text-zinc-500 ml-1">{day.date}</span></div>
        {!isReadonly && (
          <button onClick={() => setAddOpen(true)} className="px-3 py-1 text-xs rounded bg-zinc-100 hover:bg-zinc-200">+ 새 일정 추가</button>
        )}
      </div>

      {/* 오늘 메모 */}
      <div className="border rounded-xl p-4">
        <div className="text-[11px] text-zinc-500 mb-1">오늘 메모</div>
        <textarea
          value={day.note}
          onChange={(e) => setDays(prev => { const copy = structuredClone(prev); copy[index].note = e.target.value; return copy; })}
          className="w-full border rounded-lg px-3 py-2 text-sm min-h-[72px]" placeholder="어떤 날인지 간단히 적어두세요" disabled={isReadonly}
        />
        <div className="text-[11px] text-zinc-400 mt-1">※ 상단 “저장” 버튼과 함께 저장됩니다.</div>
      </div>

      {/* 일정 리스트 */}
      <div className="mt-3 space-y-3">
        {day.entries.map((en) => {
          const warn = en.time && !isWithinOpening(en.openingHours, day.date, en.time);
          return (
            <div
              key={en.id}
              draggable={!isReadonly}
              onDragStart={onDragStart(en.id)}
              onMouseEnter={() => setSelectedEntryId(en.id)}
              className={`group relative border rounded-2xl p-3 bg-white transition shadow-sm hover:shadow
                          ${selectedEntryId === en.id ? 'ring-1 ring-green-300 bg-emerald-50/40' : 'border-zinc-200'}`}
            >
              {/* 고정 좌측 드래그 핸들 영역(겹침 방지) */}
              {!isReadonly && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 select-none cursor-grab">≡</div>
              )}

              {/* 우측 상단 빨간 휴지통(hover 때만) */}
              {!isReadonly && (
                <button
                  onClick={() => removeEntry(en.id)}
                  className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition"
                  title="삭제"
                >
                  <TrashIcon />
                </button>
              )}

              {/* 본문 영역을 핸들 영역 만큼 여백 */}
              <div className="pl-7">
                {/* 시간 버튼형 select (회색 한 덩어리, ▼ 포함) */}
                <div className="inline-block mb-2">
                  <div className="relative">
                    <select
                      value={en.time || ''}
                      onChange={(e) => updateEntry(en.id, { time: e.target.value })}
                      disabled={isReadonly}
                      className="appearance-none bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-lg px-3 py-1.5 pr-7 text-xs cursor-pointer"
                    >
                      <option value="">{'--:--'}</option>
                      {times30m.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {/* ▼ 아이콘 */}
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-[10px]">▼</span>
                  </div>
                </div>

                {/* 제목/주소 */}
                <div className="font-semibold text-sm">{en.title || '제목 없음'}</div>
                {en.address && (
                  <div className="text-xs text-zinc-600 mt-1 flex items-center gap-1">
                    <MarkerOutlineIcon className="w-4 h-4" />
                    <span className="truncate">{en.address}</span>
                  </div>
                )}
                {warn && <div className="text-xs text-red-600 mt-1">⚠️ 영업시간이 아니에요!</div>}

              
              </div>
            </div>
          );
        })}
      </div>

      {/* 새 일정 추가 폼 */}
      {(!isReadonly && addOpen && (
        <div className="mt-3 bg-zinc-50 border rounded-2xl p-4">
          <div className="px-3 py-1 text-xs rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">새 일정 추가</div>
          <div className="grid gap-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">시간</div>
              <div className="relative">
                <select
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="appearance-none bg-white border rounded-lg px-3 py-2 text-sm w-full pr-7"
                >
                  {times30m.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">▼</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">장소명</div>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="방문할 장소를 입력하세요" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">주소</div>
              <input value={newAddr} onChange={(e) => setNewAddr(e.target.value)} placeholder="주소를 입력하세요" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button onClick={onAdd} className="bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 text-sm">추가</button>
              <button onClick={() => { setAddOpen(false); setNewTitle(''); setNewAddr(''); }} className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-lg py-2 text-sm">취소</button>
            </div>
          </div>
        </div>
      ))}

    </div>
  );
}


