//client\src\features\plan\components\MyPlansSidebar.js
import React, { useEffect, useState } from 'react';
import axios from '../../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

export default function MyPlansSidebar() {
  const [items, setItems] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    axios.get('/api/plans').then(({ data }) => setItems(data)).catch(() => setItems([]));
  }, []);

return (
    <div className="sticky top-20">
      <div className="bg-white rounded-2xl border shadow p-4">
        {/* 헤더 + 생성 버튼 */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-zinc-800 font-semibold">내 여행계획</h4>
          <button
            onClick={() => nav('/plans/new')}
            className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded-lg shadow"
            aria-label="여행 계획 만들기"
            title="여행 계획 만들기"
          >
            + 새 계획
          </button>
        </div>

        <div className="space-y-3 max-h-[70vh] overflow-auto pr-2">
          {items.map(p => (
            <div
              key={p.id}
              onClick={() => nav(`/plans/${p.id}`)}
              className="p-2 rounded-xl hover:bg-zinc-50 cursor-pointer"
            >
              <div className="text-sm font-medium text-zinc-800 line-clamp-1">{p.title}</div>
              <div className="text-xs text-zinc-500">{(p.country || '—')} · {(p.region || '—')}</div>
              <div className="text-xs text-zinc-500">
                {p.start_date?.slice(0,10)} ~ {p.end_date?.slice(0,10)}
              </div>
            </div>
          ))}
          {!items.length && <div className="text-sm text-zinc-500">아직 계획이 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}
