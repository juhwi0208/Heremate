// client/src/features/plan/components/SharedPlanCard.js
import React from 'react';
import axios from '../../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

export default function SharedPlanCard({ plan }) {
  const nav = useNavigate();
  const [loading, setLoading] = React.useState(false);

  const openReadonly = () => nav(`/plans/${plan.id}/readonly`);

  const copyAsTemplate = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/api/plans/${plan.id}/readonly`);
      nav('/plans/new', { state: { seedPlan: data } }); // 저장 누르기 전까지 DB에 생성 안 됨
    } catch (e) {
      console.error('[copy template]', e?.response?.status, e?.response?.data || e);
      alert('복사 템플릿 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="text-lg font-semibold">{plan.title}</div>
      <div className="text-sm text-zinc-600">{plan.country} · {plan.region}</div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={openReadonly} className="px-3 py-1 rounded-xl border">상세 보기</button>
        <button onClick={copyAsTemplate} className="px-3 py-1 rounded-xl bg-blue-600 text-white">
          {loading ? '불러오는 중…' : '복사하기'}
        </button>
      </div>
    </div>
  );
}
