//client\src\features\plan\PlanList\ShareToggle.js
import React, { useEffect, useState } from 'react';
import axios from '../../../api/axiosInstance';

/**
 * 사용법
 * <ShareToggle planId={plan.id} initialShared={plan.is_shared} onChange={(v)=>{ ... }} />
 *
 * props:
 * - planId: number (필수)
 * - initialShared: boolean | 0 | 1 (선택)  → 없으면 서버에서 상태 조회 시도
 * - onChange: (isShared: boolean) => void (선택)
 */
export default function ShareToggle({ planId, initialShared, onChange }) {
  const [isShared, setIsShared] = useState(
    typeof initialShared === 'boolean'
      ? initialShared
      : initialShared === 1
  );
  const [loading, setLoading] = useState(false);

  // initialShared가 없으면 서버에서 현재 상태를 조회
  useEffect(() => {
    if (typeof initialShared === 'undefined') {
      (async () => {
        try {
          const { data } = await axios.get(`/api/plans/${planId}/readonly`);
          setIsShared(!!data?.is_shared);
        } catch (e) {
          // 읽기 실패해도 토글 UI는 표시 (기본 false)
        }
      })();
    }
  }, [planId, initialShared]);

  // 토글 함수 
  const toggleShare = async () => {
    if (!planId || loading) return;
    setLoading(true);
    try {
      if (isShared) {
        await axios.delete(`/api/plans/${planId}/share`);
        setIsShared(false);
        onChange && onChange(false);
      } else {
        await axios.post(`/api/plans/${planId}/share`);
        setIsShared(true);
        onChange && onChange(true);
      }
    } catch (e) {
      alert('공유 설정에 실패했어요. 로그인 상태와 권한을 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };


  const base =
    'px-3 py-1 rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-offset-2';
  const onCls =
    'bg-green-600 text-white border-green-600 hover:opacity-90 focus:ring-green-600';
  const offCls =
    'bg-white text-zinc-800 hover:bg-zinc-50 border-zinc-300 focus:ring-zinc-300';

  return (
    <button
      type="button"
      onClick={toggleShare}
      disabled={loading}
      aria-pressed={isShared}
      title={isShared ? '공유 중' : '공유하기'}
      className={`${base} ${isShared ? onCls : offCls} disabled:opacity-50`}
    >
      {loading ? '처리 중…' : isShared ? '공유 중' : '공유하기'}
    </button>
  );
}
