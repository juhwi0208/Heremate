// client/src/features/plan/components/SharedPlanCard.js (핵심만 교체)
import React from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function SharedPlanCard({ plan }) {
  const nav = useNavigate();
  const [copying, setCopying] = React.useState(false);

  const copyPlan = async () => {
    const token = localStorage.getItem('token');
    if (!token) return alert('로그인이 필요합니다.');
    try {
      setCopying(true);
      const { data } = await axios.post(`/api/plans/${plan.id}/copy`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('내 계획으로 복사되었습니다.');
      if (data?.newPlanId) nav(`/plans/${data.newPlanId}`);
    } catch (e) {
      console.error('[copyPlan]', e?.response?.status, e?.response?.data || e);
      alert('복사에 실패했습니다.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-white">
      {/* ...카드 본문... */}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={copyPlan} className="px-3 py-1 rounded-xl bg-blue-600 text-white">
          {copying ? '복사 중…' : '복사하기'}
        </button>
        <button onClick={() => nav(`/plans/${plan.id}/readonly`)} className="text-sm underline">
          상세 보기(읽기 전용)
        </button>
      </div>
    </div>
  );
}
