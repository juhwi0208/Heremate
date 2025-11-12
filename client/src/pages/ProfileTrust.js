// client/src/pages/ProfileTrust.js
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../api/axiosInstance';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import TrustBadge from '../components/TrustBadge';
import ConstellationCard from '../components/ConstellationCard';
import { SummaryGrid, TagChips, ActivityGrid } from '../components/TrustSummaryCards';
import ReviewModal from '../features/review/ReviewModal';
import ReportModal from '../features/report/ReportModal';

export default function ProfileTrust() {
  const params = useParams();
  const navigate = useNavigate();
  const profileId = Number(params.id);
  const [me, setMe] = useState(null);
  const [trust, setTrust] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const [{ data: meData }, { data: trustData }] = await Promise.all([
      axios.get('/users/me'),
      axios.get(`/users/${profileId}/trust`),
    ]);
    setMe(meData);
    setTrust(trustData);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [profileId]);

  const myProfile = useMemo(() => me && me.id === profileId, [me, profileId]);

  if (loading) {
    return <div className="min-h-[60vh] grid place-items-center text-zinc-500">로딩중…</div>;
  }
  if (!trust) {
    return <div className="min-h-[60vh] grid place-items-center text-zinc-500">데이터 없음</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 상단 프로필 카드 */}
      <section className="px-6 md:px-20 py-10">
        <div className="grid md:grid-cols-2 gap-6">
          {/* 좌: 프로필 */}
          <Card className="rounded-2xl">
            <CardContent className="p-6 flex gap-4">
              <div className="shrink-0">
                <div className="w-24 h-24 rounded-full border bg-zinc-100 overflow-hidden" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-semibold">{me?.nickname || '사용자'}</div>
                    <div className="mt-2"><TrustBadge aura={trust.aura} /></div>
                  </div>
                  <div className="flex gap-2">
                    {!myProfile && <Button onClick={()=>navigate(`/chat/${profileId}`)}>채팅하기</Button>}
                    {myProfile && <Button variant="outline" onClick={()=>navigate('/mypage')}>프로필 수정</Button>}
                  </div>
                </div>
                <div className="mt-2 text-sm text-zinc-600">함께하면 반짝입니다</div>
                <div className="mt-1 text-xs text-zinc-500">{new Date(me?.created_at).toLocaleDateString()} 가입</div>
              </div>
            </CardContent>
          </Card>

          {/* 우: 별자리 */}
          <ConstellationCard constellation={trust.constellation} />
        </div>
      </section>

      {/* 하단 요약 카드 */}
      <section className="px-6 md:px-20 pb-14 space-y-6">
        <SummaryGrid
          uniquePartners={trust.constellation.uniquePartners}
          trips={trust.constellation.trips}
          positiveRatio={trust.constellation.positiveRatio}
        />

        <Card className="rounded-2xl">
          <CardContent className="p-6">
            <div className="text-sm text-zinc-500 mb-3">후기 키워드</div>
            <TagChips tags={trust.topTags} />
          </CardContent>
        </Card>

        <ActivityGrid stories={2} activePlans={1} totalPlans={2} />

        {/* 액션: 후기/신고 */}
        <div className="flex gap-3">
          {!myProfile && (
            <>
              <ReviewModal targetId={profileId} tripId={1} onSaved={reload} />
              <ReportModal targetUserId={profileId} context="chat" />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
