// client/src/features/plan/pages/PlanList.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import SharedPlanCard from '../components/SharedPlanCard';
import MyPlansSidebar from '../components/MyPlansSidebar';
import PlanFilters from '../components/PlanFilters';

export default function PlanList() {
  const [shared, setShared] = useState([]);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState(null);

  // 필터 상태(있다면 유지)
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [prefs, setPrefs] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadShared = async () => {
      try {
        const { data } = await axios.get('/api/plans/shared');
        if (mounted) setShared(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn('shared fetch failed', e?.response?.status);
        if (mounted) {
          setShared([]);
          setError('공유 피드를 불러오지 못했습니다.');
        }
      }
    };

    const loadMine = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setMine([]);
        return;
      }
      try {
        const { data } = await axios.get('/api/plans', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (mounted) setMine(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn('mine fetch failed', e?.response?.status);
        if (mounted) setMine([]);
      }
    };

    loadShared();
    loadMine();

    return () => (mounted = false);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <h2 className="text-2xl font-bold text-green-700 mb-4">여행 계획</h2>

      <PlanFilters
        country={country} setCountry={setCountry}
        region={region} setRegion={setRegion}
        monthFrom={monthFrom} setMonthFrom={setMonthFrom}
        monthTo={monthTo} setMonthTo={setMonthTo}
        prefs={prefs} setPrefs={setPrefs}
      />

      {error && <div className="mt-3 text-sm text-red-600">⚠ {error}</div>}

      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* 공유 피드 */}
        <div className="col-span-12 md:col-span-8 space-y-4">
          {shared.length === 0 ? (
            <div className="text-sm text-zinc-500">표시할 공유 계획이 없습니다.</div>
          ) : (
            shared.map((p) => <SharedPlanCard key={p.id} plan={p} />)
          )}
        </div>

        {/* 내 계획 사이드바 (여기 상단에 “+ 새 계획” 버튼 있음) */}
        <div className="col-span-12 md:col-span-4">
          <MyPlansSidebar itemsOverride={mine} />
        </div>
      </div>
    </div>
  );
}
