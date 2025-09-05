import React from 'react';

const ALL_PREFS = [
  { key: 'food', label: '맛집' },
  { key: 'nature', label: '자연' },
  { key: 'history', label: '역사' },
  { key: 'shopping', label: '쇼핑' },
  { key: 'museum', label: '미술/박물관' },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  mm: String(i + 1).padStart(2, '0'),
  label: `${i + 1}월`,
}));

export default function PlanFilters({
  country, setCountry,
  region, setRegion,
  monthFrom, setMonthFrom,
  monthTo, setMonthTo,
  prefs, setPrefs,
}) {
  const togglePref = (k) =>
    setPrefs((prev) => (prev.includes(k) ? prev.filter((p) => p !== k) : [...prev, k]));
  const reset = () => {
    setCountry('');
    setRegion('');
    setMonthFrom('');
    setMonthTo('');
    setPrefs([]);
  };

  // UI는 "1월~12월"을 보여주되, 값은 "YYYY-MM"으로 저장해서 백엔드(listSharedPlans)가 기대하는 형태 유지
  const yyyy = new Date().getFullYear();
  const setMonthWithYear = (setter) => (mm) => {
    if (!mm) return setter('');
    setter(`${yyyy}-${mm}`);
  };
  const extractMM = (yyyyMM) => (yyyyMM ? yyyyMM.split('-')[1] : '');

  return (
    <div className="bg-white rounded-2xl shadow p-3 border hover:shadow-md transition">
      {/* 한 줄 그리드: 나라, 지역, 시작월, 끝월, 취향(가로 스크롤), 초기화 */}
      <div className="grid grid-cols-12 gap-2 items-center">
        {/* 나라 */}
        <div className="col-span-2">
          <label className="block text-xs text-zinc-600 mb-1">나라</label>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="예: 한국, 일본"
            className="w-full border rounded-xl px-2 h-8 text-xs focus:ring-2 focus:ring-green-600 outline-none"
          />
        </div>

        {/* 지역 */}
        <div className="col-span-2">
          <label className="block text-xs text-zinc-600 mb-1">지역</label>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="예: 서울, 부산, 마쓰야마"
            className="w-full border rounded-xl px-2 h-8 text-xs focus:ring-2 focus:ring-green-600 outline-none"
          />
        </div>

        {/* 시작(월) */}
        <div className="col-span-2">
          <label className="block text-xs text-zinc-600 mb-1">시작(월)</label>
          <select
            value={extractMM(monthFrom)}
            onChange={(e) => setMonthWithYear(setMonthFrom)(e.target.value)}
            className="w-full border rounded-xl px-2 h-8 text-xs focus:ring-2 focus:ring-green-600 outline-none"
          >
            <option value="">전체</option>
            {MONTHS.map((m) => (
              <option key={m.mm} value={m.mm}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* 끝(월) */}
        <div className="col-span-2">
          <label className="block text-xs text-zinc-600 mb-1">끝(월)</label>
          <select
            value={extractMM(monthTo)}
            onChange={(e) => setMonthWithYear(setMonthTo)(e.target.value)}
            className="w-full border rounded-xl px-2 h-8 text-xs focus:ring-2 focus:ring-green-600 outline-none"
          >
            <option value="">전체</option>
            {MONTHS.map((m) => (
              <option key={m.mm} value={m.mm}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* 여행 취향 (가로 스크롤로 한 줄 유지) */}
        <div className="col-span-3">
          <label className="block text-xs text-zinc-600 mb-1">여행 취향</label>
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap no-scrollbar">
            {ALL_PREFS.map((p) => (
              <button
                key={p.key}
                onClick={() => togglePref(p.key)}
                className={`px-3 h-8 text-xs rounded-full border transition ${
                  prefs.includes(p.key)
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white hover:bg-zinc-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 초기화 */}
        <div className="col-span-1 flex items-end">
          <button
            onClick={reset}
            className="w-full h-8 px-3 rounded-xl border text-zinc-700 hover:bg-zinc-50 text-xs"
          >
            초기화
          </button>
        </div>
      </div>
    </div>
  );
}
