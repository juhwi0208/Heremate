// src/features/plan/PlanEditor/DayTabs.js
import React from 'react';

export default function DayTabs({ days, activeIdx, onSelect }) {
  return (
    <div className="mx-4 md:mx-6 mt-6">
      <div className="bg-white border rounded-2xl shadow-sm">
        <div className="flex gap-2 overflow-x-auto no-scrollbar p-3">
          {days.map((d, i) => (
            <button
              key={d.date}
              onClick={() => onSelect(i)}
              className={`px-4 py-2 rounded-lg text-sm border transition relative ${
                i === activeIdx
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border-zinc-200'
              }`}
            >
              <div className="font-semibold">Day {i + 1}</div>
              <div className="text-[11px] opacity-80">{d.date}</div>

              {/* 활성 탭 하단 초록 라인 */}
              {i === activeIdx && (
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-green-600" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
