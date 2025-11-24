/// client/src/pages/ProfileTrust.js
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from '../api/axiosInstance';
import { Card, CardContent} from '../components/ui/card';
import { Button } from '../components/ui/button';
import TrustBadge from '../components/TrustBadge';
import ConstellationCard from '../components/ConstellationCard';
import { SummaryGrid, TagChips, ActivityGrid } from '../components/TrustSummaryCards';
import ReviewModal from '../features/review/ReviewModal';
import ReportModal from '../features/report/ReportModal';
import { Camera, Lock, ChevronRight } from 'lucide-react';

// 후기 태그 라벨 매핑 (ProfileTrust 화면에서 표시용)
const TAG_LABELS = {
  // negative
  noshow: '약속 장소/시간을 지키지 않았어요',
  rude: '말투/태도가 무례했어요',
  unsafe: '불안하거나 위험한 행동을 했어요',
  dirty: '위생/청결이 많이 아쉬웠어요',
  money: '비용 관련 갈등이 있었어요',
  schedule: '일정을 마음대로 바꾸었어요',
  etc: '기타 아쉬운 점이 있었어요',

  // neutral
  quiet: '조용해서 대화가 많이 없었어요',
  preference_diff: '여행 스타일이 조금 안 맞았어요',
  late_small: '약속에 약간 늦는 편이었어요',
  photo_only: '사진 위주로 움직였어요',
  separate: '각자 따로 움직이는 시간이 많았어요',

  // positive
  kind: '매너가 좋고 친절했어요',
  talk: '대화가 잘 통했어요',
  plan: '일정/예산 조율을 잘했어요',
  photo: '사진을 잘 찍어줬어요',
  food: '맛집을 잘 찾아줬어요',
  on_time: '시간 약속을 잘 지켰어요',
  again: '다음에 또 같이 가고 싶어요',
};

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  'http://localhost:4000';

const resolveAvatarUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE.replace(/\/$/, '')}${path}`;
};

/* 공용 RowItem (MyPage에서 가져옴) */
function RowItem({ title, desc, actionLabel, onAction, disabled, titleAttr }) {
  return (
    <div className="flex items-center justify-between border-t py-4 first:border-t-0">
      <div>
        <div className="text-sm font-medium text-zinc-800">{title}</div>
        <div className="text-xs text-zinc-500">{desc}</div>
      </div>
      <button
        onClick={onAction}
        disabled={disabled}
        title={titleAttr}
        className={`rounded-md border px-3 py-1.5 text-sm ${
          disabled
            ? 'text-zinc-400 cursor-not-allowed bg-zinc-50'
            : 'text-zinc-700 hover:bg-zinc-50'
        }`}
      >
        {actionLabel}
      </button>
    </div>
  );
}

/* 날짜 포맷 헬퍼 (MyPage에서 가져옴) */
function fmtKoreanDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/* 아우라 링 그라데이션 스타일 – UserTrustPreview와 동일하게 */
function auraRingStyle(aura) {
  const tone = aura?.tone || 'neutral';

  switch (tone) {
    case 'warm':
      return {
        background:
          'radial-gradient(circle, rgba(250,204,21,0.9) 0%, rgba(250,204,21,0) 70%)',
      };
    case 'cool':
      return {
        background:
          'radial-gradient(circle, rgba(56,189,248,0.9) 0%, rgba(56,189,248,0) 70%)',
      };
    default:
      // neutral / 그 외
      return {
        background:
          'radial-gradient(circle, rgba(52,211,153,0.9) 0%, rgba(52,211,153,0) 70%)',
      };
  }
}
/* ------------------ 메인 컴포넌트 ------------------ */

export default function ProfileTrust({ setUser }) {
  const params = useParams();
  const navigate = useNavigate();

  const [me, setMe] = useState(null); // /api/users/me 원본
  const [trust, setTrust] = useState(null);
  const [loading, setLoading] = useState(true);

  // 마이페이지용 프로필 편집 상태 (MyPage에서 가져온 구조)
  const [profile, setProfile] = useState({
    id: null,
    nickname: '',
    email: '',
    joinedAt: '',
    role: 'user',
    bio: '',
    avatarUrl: '',
    kakaoId: null,
    emailVerified: false,
    hasPassword: true,
  });

  const originalNickRef = useRef('');
  const [nickState, setNickState] = useState({
    checking: false,
    valid: true,
    msg: '',
  });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  // 하단 탭: 여행스토리 / 여행계획 / 게시글 / 프로필수정
  const [tab, setTab] = useState('stories');

  // 활동 현황 카운트 (실제 데이터 반영용)
  // 활동 현황 카운트 (실제 데이터 반영용)
  const [activityStats, setActivityStats] = useState({
    stories: 0,
    activePlans: 0,
    totalPlans: 0,
    posts: 0,
  });


  // /profile/:id 이면 그 id, /mypage 이면 me.id
  const profileId = useMemo(() => {
    if (params.id) return Number(params.id);
    if (me?.id) return me.id;
    return null;
  }, [params.id, me]);

  const myProfile = useMemo(() => {
   return !!(me && profileId && me.id === profileId);
 }, [me, profileId]);

  // ✅ 마이페이지 진입 시 한 번 실제 데이터로 활동 현황 미리 계산
  useEffect(() => {
    if (!me?.id || !profileId) return;
    // 내 마이페이지가 아니면 실행 안 함
    if (me.id !== profileId) return;

    let cancelled = false;

    (async () => {
      try {
        const [storiesRes, plansRes, matesRes] = await Promise.all([
          axios.get('/api/stories?me=1'),
          axios.get('/api/plans'),
          axios.get('/api/mates', { params: { me: 1 } }),
        ]);

        if (cancelled) return;

        const storiesArr = Array.isArray(storiesRes.data)
          ? storiesRes.data
          : [];
        const plansArr = Array.isArray(plansRes.data) ? plansRes.data : [];
        const matesArr = Array.isArray(matesRes.data) ? matesRes.data : [];

        const myPlans = plansArr.filter((p) => {
          const ownerId =
            p.user_id ??
            p.owner_id ??
            p.userId ??
            p.writer_id ??
            p.author_id;
          return ownerId === me.id;
        });

        setActivityStats({
          stories: storiesArr.length,
          totalPlans: myPlans.length,
          activePlans: activityGuessActive(myPlans),
          posts: matesArr.length,
        });
      } catch (e) {
        console.error('activity preload error', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me?.id, profileId]);

  

  /* ------------------ 데이터 로딩 (me + trust) ------------------ */

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1) 내 정보
      const { data: meData } = await axios.get('/api/users/me');
      setMe(meData);

      // 프로필 편집 상태에도 반영
      setProfile((p) => ({
        ...p,
        id: meData?.id ?? p.id,
        nickname: meData?.nickname ?? p.nickname,
        email: meData?.email ?? p.email,
        joinedAt: meData?.created_at || meData?.joinedAt || p.joinedAt,
        role: meData?.role ?? p.role,
        bio: meData?.bio ?? '',
        avatarUrl: resolveAvatarUrl(meData?.avatarUrl) ?? '',
        kakaoId: meData?.kakaoId ?? null,
        emailVerified: !!meData?.emailVerified,
        hasPassword:
          typeof meData?.has_password === 'number'
            ? !!meData?.has_password
            : meData?.hasPassword ?? true,
      }));
      if (meData?.nickname) originalNickRef.current = meData.nickname;

      // 2) 대상 사용자 id 결정
      const targetId = params.id ? Number(params.id) : meData.id;

      // 3) 대상 사용자 신뢰 지표
      const { data: trustData } = await axios.get(
        `/api/users/${targetId}/trust`
      );
      setTrust(trustData || null);
    } catch (e) {
      console.error('ProfileTrust fetch error', e);
      setTrust(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ------------------ 닉네임 중복 체크 (MyPage 로직) ------------------ */

  useEffect(() => {
    const nick = profile.nickname?.trim();
    if (!nick) {
      setNickState({
        checking: false,
        valid: false,
        msg: '닉네임을 입력해 주세요.',
      });
      return;
    }
    if (nick === originalNickRef.current) {
      setNickState({ checking: false, valid: true, msg: '' });
      return;
    }
    setNickState((s) => ({ ...s, checking: true, msg: '' }));
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get('/auth/check-nickname', {
          params: { nickname: nick },
        });
        setNickState({
          checking: false,
          valid: !data?.exists,
          msg: data?.exists ? '이미 사용 중인 닉네임입니다.' : '',
        });
      } catch {
        setNickState({ checking: false, valid: true, msg: '' });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [profile.nickname]);

  /* ------------------ 프로필 이미지 처리 ------------------ */

  const onPickImage = () => fileRef.current?.click();
  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  /* ------------------ 프로필 저장 (닉네임/소개/아바타) ------------------ */

  const onSaveProfile = useCallback(
    async (e) => {
      e?.preventDefault();
      if (saving) return;
      if (!nickState.valid || nickState.checking) {
        alert('닉네임 중복을 확인해 주세요.');
        return;
      }
      try {
        setSaving(true);
        const form = new FormData();
        form.append('nickname', profile.nickname || '');
        form.append('bio', profile.bio || '');
        if (fileRef.current?.files?.[0]) {
          form.append('avatar', fileRef.current.files[0]);
        }

        const { data } = await axios.put('/api/users/me', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        // ✅ 서버에서 내려준 avatarUrl / nickname 사용
        const newUrl = resolveAvatarUrl(data?.avatarUrl) || avatarPreview;
        const newNick = data?.nickname || profile.nickname;

        if (newUrl) {
          setProfile((p) => ({
            ...p,
            avatarUrl: newUrl,
          }));
        }
        if (newNick) {
          setProfile((p) => ({
            ...p,
            nickname: newNick,
          }));
          originalNickRef.current = newNick;
        }

        // ✅ 헤더 오른쪽 user도 함께 업데이트
        if (typeof setUser === 'function') {
          setUser((u) => ({
            ...u,
            nickname: newNick || u?.nickname,
            avatarUrl: newUrl || u?.avatarUrl,
          }));
        }

        alert('프로필이 저장되었습니다.');
      } catch (err) {
        console.error(err);
        alert('프로필 저장에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [saving, nickState, profile, avatarPreview, setUser]
  );


  /* ------------------ 카카오 연동 / 회원탈퇴 ------------------ */

  const isKakaoCreated = !profile.hasPassword;
  const isLinked = !!profile.kakaoId;

  const onLinkKakao = () => {
    const API_BASE =
      (typeof import.meta !== 'undefined' &&
        import.meta.env?.VITE_API_BASE_URL) ||
      process.env.REACT_APP_API_BASE_URL ||
      'http://localhost:4000';
    const token = localStorage.getItem('token') || '';
    window.location.href = `${API_BASE.replace(
      /\/$/,
      ''
    )}/auth/kakao/start?mode=link&token=${encodeURIComponent(token)}`;
  };

  const onDelete = async () => {
    if (
      !window.confirm(
        '정말 탈퇴하시겠어요? 이 작업은 되돌릴 수 없습니다.'
      )
    )
      return;
    try {
      if (profile.hasPassword) {
        const pw = window.prompt('현재 비밀번호를 입력해 주세요.');
        if (!pw) return;
        await axios.delete('/api/users/me', { data: { currentPassword: pw } });
      } else {
        await axios.delete('/api/users/me', { data: { confirm: true } });
      }
      alert('탈퇴 처리가 완료되었습니다.');
      localStorage.removeItem('token');
      window.location.href = '/';
    } catch (e) {
      alert(e.response?.data?.error || '탈퇴 처리 실패');
    }
  };

  /* ------------------ 상단 카드 표시용 타겟 유저 ------------------ */

  const targetUser = useMemo(() => {
    if (myProfile) return profile;
    // trust 응답 안에 들어오는 사용자 정보가 있다면 우선 사용
    return (
      trust?.user ||
      trust?.target ||
      {
        nickname: '사용자',
      }
    );
  }, [myProfile, profile, trust]);

  /* ------------------ 로딩/에러 처리 ------------------ */

  if (loading || !me || profileId == null) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-zinc-500">
        로딩중…
      </div>
    );
  }

  if (!trust) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-zinc-500">
        데이터 없음
      </div>
    );
  }

  /* ------------------ JSX ------------------ */

  const activityProps = myProfile
    ? activityStats
    : {
        stories: trust.activity?.stories ?? 0,
        activePlans: trust.activity?.activePlans ?? 0,
        totalPlans: trust.activity?.totalPlans ?? 0,
        posts: trust.activity?.posts ?? 0,
      };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* 상단 프로필 + 별자리 */}
      <section className="px-6 md:px-20 py-10">
        <div className="grid md:grid-cols-2 gap-6 items-stretch">
          {/* 좌: 프로필 카드 */}
          <Card className="rounded-2xl shadow-sm h-full">
            <CardContent className="p-6 flex gap-4 h-full">
              <div className="shrink-0">
                {/* ✅ 오로라 그라데이션 링 */}
                <div
                  className="w-28 h-28 rounded-full p-[20px]"
                  style={auraRingStyle(trust.aura)}
                >
                  <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                    <img
                      src={
                        myProfile
                          ? avatarPreview ||
                            profile.avatarUrl ||
                            '/assets/avatar_placeholder.png'
                          : targetUser.avatarUrl
                            ? resolveAvatarUrl(targetUser.avatarUrl)
                            :'/assets/avatar_placeholder.png'
                      }
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xl font-semibold">
                      {targetUser.nickname || '사용자'}
                    </div>
                    {/* 아우라 뱃지 */}
                    <div className="mt-2">
                      <TrustBadge aura={trust.aura} />
                    </div>
                  </div>

                  {myProfile && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-sm"
                      onClick={() => {
                        setTab('profile');
                        const el =
                          document.getElementById('profile-edit-section');
                        if (el) {
                          el.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        }
                      }}
                    >
                      프로필 수정
                    </Button>
                  )}
                </div>

                {/* ✅ 내 프로필일 때: 이메일 / 가입일 / bio 박스 (bio 위치 이동 + 회색 배경) */}
                {myProfile && (
                  <>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-yellow-50 px-3 py-1 text-xs text-yellow-800">
                      <span className="font-medium">
                        {profile.email || '-'}
                      </span>
                      <span
                        className={
                          profile.emailVerified
                            ? 'text-[11px] text-green-600'
                            : 'text-[11px] text-zinc-500'
                        }
                      >
                        {profile.emailVerified ? '(인증됨)' : '(미인증)'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      가입일: {fmtKoreanDate(profile.joinedAt) || '-'}
                    </div>
                    {/* bio 전용 박스 */}
                    <div className="mt-3 rounded-xl bg-[#F5F5F7] px-3 py-2 text-sm text-zinc-700 min-h-[52px]">
                      {profile.bio?.trim()
                        ? profile.bio
                        : '한 줄 소개를 작성해보세요.'}
                    </div>
                  </>
                )}

                {/* ✅ 다른 사람 프로필: bio 박스만 노출 */}
                {!myProfile && (
                  <div className="mt-3 rounded-xl bg-[#F5F5F7] px-3 py-2 text-sm text-zinc-700 min-h-[52px]">
                    {targetUser.bio?.trim()
                      ? targetUser.bio
                      : '소개가 아직 없어요.'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 우: 별자리 카드 - 좌측 카드와 높이 맞추기 위해 h-full 전달 */}
          <ConstellationCard
            constellation={trust.constellation}
            className="h-full"
          />
        </div>
      </section>


      {/* 하단: 신뢰 지표 / 후기 키워드 / 활동 현황 + 탭 영역 */}
      <section className="px-6 md:px-20 pb-20 space-y-6">
        {/* 신뢰 지표 블럭 */}
        <div className="rounded-2xl bg-white shadow-sm p-6 space-y-4">
          <div className="text-sm font-semibold text-zinc-900">신뢰 지표</div>
          <div className="rounded-xl bg-[#F5F5F7] p-4">
            <SummaryGrid
              aura={trust.aura}
              reviewCount={trust.reviewCount}
              positivePercent={trust.positivePercent}
            />
          </div>
        </div>

        {/* ===== 후기 키워드 ===== */}
        <div className="rounded-2xl bg-white shadow-sm p-4 space-y-4">
        {Array.isArray(trust.topTags) && trust.topTags.length > 0 ? (
          <div className="mt-1">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              가장 많이 받은 키워드
            </h3>
            <div className="rounded-xl bg-[#F5F5F7] p-4">
              <div className="flex flex-wrap gap-2">
                {trust.topTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    {TAG_LABELS[tag] || tag}
                  </span> 
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-xs text-gray-400">
            아직 받은 후기 키워드가 없습니다.
          </div>
        )}
        </div>

        {/* 활동 현황 블럭 (실제 데이터 반영) */}
        <div className="rounded-2xl bg-white shadow-sm p-6 space-y-3">
          <div className="text-sm font-semibold text-zinc-900">활동 현황</div>
          <div className="rounded-xl bg-[#F5F5F7] p-4">
            <ActivityGrid
              stories={activityProps.stories}
              activePlans={activityProps.activePlans}
              totalPlans={activityProps.totalPlans}
              posts={activityProps.posts}
            />
          </div>
        </div>

        {/* 후기 작성 / 신고 (상대 프로필에서만) */}
        {!myProfile && (
          <div className="flex gap-3">
            <ReviewModal
              targetId={profileId}
              tripId={1} // TODO: 실제 Trip id로 교체
              onSaved={fetchAll}
            />
            <ReportModal targetUserId={profileId} context="chat" />
          </div>
        )}

        {/* ------------------ 하단 탭: 나의 활동/프로필 수정 ------------------ */}
        {myProfile && (
          <div className="mt-8">
            {/* 탭 버튼들 */}
            <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2 text-sm">
              <button
                onClick={() => setTab('stories')}
                className={`rounded-full px-3 py-1 ${
                  tab === 'stories'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                여행스토리
              </button>
              <button
                onClick={() => setTab('plans')}
                className={`rounded-full px-3 py-1 ${
                  tab === 'plans'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                여행계획
              </button>
              <button
                onClick={() => setTab('posts')}
                className={`rounded-full px-3 py-1 ${
                  tab === 'posts'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                게시글
              </button>
              <button
                onClick={() => setTab('profile')}
                className={`rounded-full px-3 py-1 ${
                  tab === 'profile'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                프로필수정
              </button>
            </div>

            {/* 탭 컨텐츠 */}
            <div className="mt-4">
              {tab === 'stories' && (
                <StoriesSection
                  onCountChange={(cnt) =>
                    setActivityStats((s) => ({ ...s, stories: cnt }))
                  }
                />
              )}
              {tab === 'plans' && (
                <PlansSection
                  myId={profile.id}
                  onStatsChange={(stats) =>
                    setActivityStats((s) => ({ ...s, ...stats }))
                  }
                />
              )}
              {tab === 'posts' && (
                <MatesSection
                  myId={profile.id}
                  onCountChange={(cnt) =>
                    setActivityStats((s) => ({ ...s, posts: cnt }))
                  }
                />
              )}
              {tab === 'profile' && (
                <ProfileEditSection
                  profile={profile}
                  setProfile={setProfile}
                  nickState={nickState}
                  onSaveProfile={onSaveProfile}
                  saving={saving}
                  avatarPreview={avatarPreview}
                  fileRef={fileRef}
                  onPickImage={onPickImage}
                  onFileChange={onFileChange}
                  isKakaoCreated={isKakaoCreated}
                  isLinked={isLinked}
                  onGoEmailChange={() => navigate('/account/email')}
                  onGoPasswordChange={() =>
                    navigate('/forgot-password?mode=change')
                  }
                  onLinkKakao={onLinkKakao}
                  onDelete={onDelete}
                />
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------ 하단 탭용 섹션 컴포넌트들 ------------------ */

// 1) 여행 스토리 탭 (내가 쓴 스토리 + 수정/삭제)
function StoriesSection({ onCountChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await axios.get('/api/stories?me=1');
        if (!mounted) return;
        const arr = Array.isArray(data) ? data : [];
        setItems(arr);
        onCountChange && onCountChange(arr.length);
      } catch {
        setItems([]);
        onCountChange && onCountChange(0);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('이 스토리를 삭제하시겠어요?')) return;
    try {
      await axios.delete(`/api/stories/${id}`);
      const next = items.filter((s) => s.id !== id);
      setItems(next);
      onCountChange && onCountChange(next.length);
    } catch (e) {
      alert(e.response?.data?.error || '삭제에 실패했습니다.');
    }
  };

  if (loading)
    return (
      <div className="rounded-2xl border bg-white p-6 text-sm text-zinc-500 shadow-sm">
        로딩 중...
      </div>
    );

  if (!items.length) {
    return (
      <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
        <div className="mb-2 text-sm font-medium text-zinc-900">
          아직 작성한 스토리가 없어요
        </div>
        <div className="mb-4 text-xs text-zinc-500">
          첫 여행 스토리를 작성해보세요
        </div>
        <Link
          to="/stories/new"
          className="inline-flex rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          스토리 작성하기
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <article
          key={s.id}
          className="group overflow-hidden rounded-2xl border bg-white shadow-sm"
        >
          <div className="aspect-[4/3] w-full bg-zinc-100">
            {(() => {
              const cover =
                s.cover_url ||
                s.coverUrl ||
                s.thumbnail ||
                s.thumbnail_url ||
                s.image ||
                s.image_url ||
                '';
              return cover ? (
                <img
                  src={cover}
                  alt={s.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                  No Image
                </div>
              );
            })()}

          </div>
          <div className="p-4">
            <div className="line-clamp-1 text-sm font-medium text-zinc-900">
              {s.title || '제목 없음'}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {fmtKoreanDate(s.created_at)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 opacity-0 transition group-hover:opacity-100">
              <Link
                to={`/stories/${s.id}`}
                className="rounded-md border px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                열기
              </Link>
              <Link
                to={`/stories/${s.id}/edit`}
                className="rounded-md border px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                수정
              </Link>
              <button
                onClick={() => handleDelete(s.id)}
                className="rounded-md border px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                삭제
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

// 2) 여행 계획 탭 (내가 만든 Plan 리스트 + 수정/삭제)
function PlansSection({ myId, onStatsChange }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await axios.get('/api/plans');
        if (!mounted) return;
        const arr = Array.isArray(data) ? data : [];
        const mine = arr.filter((p) => {
          const owner =
            p.user_id ?? p.owner_id ?? p.author_id ?? p.userId ?? null;
          return !myId || owner === myId;
        });

        setPlans(mine);

        // 활동 현황 카운트 업데이트
        const total = mine.length;

        const now = new Date();
        const active = mine.filter((p) => {
          const end =
            p.end_date ||
            p.endDate ||
            p.date_to ||
            p.dateTo ||
            p.end ||
            p.endTime;
          if (!end) return false;
          const d = new Date(end);
          if (Number.isNaN(d.getTime())) return false;
          return d >= now;
        }).length;

        onStatsChange &&
          onStatsChange({ totalPlans: total, activePlans: active });
      } catch {
        setPlans([]);
        onStatsChange && onStatsChange({ totalPlans: 0, activePlans: 0 });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('이 여행 계획을 삭제하시겠어요?')) return;
    try {
      await axios.delete(`/api/plans/${id}`);
      const next = plans.filter((p) => p.id !== id);
      setPlans(next);
      const total = next.length;
      onStatsChange &&
        onStatsChange({
          totalPlans: total,
          // active 재계산 (단순화)
          activePlans: Math.min(
            total,
            activityGuessActive(next) // 아래 헬퍼
          ),
        });
    } catch (e) {
      alert(e.response?.data?.error || '삭제에 실패했습니다.');
    }
  };

  if (loading)
    return (
      <div className="rounded-2xl border bg-white p-6 text-sm text-zinc-500 shadow-sm">
        로딩 중...
      </div>
    );

  if (!plans.length) {
    return (
      <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
        <div className="mb-2 text-sm font-medium text-zinc-900">
          작성한 여행 계획이 없어요
        </div>
        <div className="mb-4 text-xs text-zinc-500">
          새 여행 계획을 만들어보세요
        </div>
        <Link
          to="/plans/new"
          className="inline-flex rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          여행 계획 만들기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map((p) => (
        <div
          key={p.id}
          className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="mb-1 text-sm font-semibold text-zinc-900 line-clamp-2">
                {p.title || '제목 없음'}
              </div>
              <div className="text-xs text-zinc-500">
                {p.region || p.location || '-'}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs text-zinc-500">
              <div>
                {p.start_date || p.startDate || p.date_from || p.dateFrom
                  ? fmtKoreanDate(
                      p.start_date || p.startDate || p.date_from || p.dateFrom
                    )
                  : ''}
                {(p.end_date || p.endDate || p.date_to || p.dateTo) && ' ~ '}
                {p.end_date || p.endDate || p.date_to || p.dateTo
                  ? fmtKoreanDate(
                      p.end_date || p.endDate || p.date_to || p.dateTo
                    )
                  : ''}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link
              to={`/plans/${p.id}`}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-zinc-700 hover:bg-zinc-50"
            >
              계획 열기
            </Link>
            <button
              onClick={() => handleDelete(p.id)}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-zinc-700 hover:bg-zinc-50"
            >
              삭제
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function activityGuessActive(plans) {
  const now = new Date();
  return plans.filter((p) => {
    const end =
      p.end_date ||
      p.endDate ||
      p.date_to ||
      p.dateTo ||
      p.end ||
      p.endTime;
    if (!end) return false;
    const d = new Date(end);
    if (Number.isNaN(d.getTime())) return false;
    return d >= now;
  }).length;
}

// 3) 게시글 탭 (내가 쓴 메이트 글 + 삭제)
function MatesSection({ myId, onCountChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          // ✅ 서버에서 이미 "내가 쓴 글"만 내려받도록 me=1 사용
          const { data } = await axios.get('/api/mates', {
            params: { me: 1 },
          });
          if (!mounted) return;
          const list = Array.isArray(data) ? data : [];
          setItems(list);
          onCountChange && onCountChange(list.length);
        } catch {
          setItems([]);
          onCountChange && onCountChange(0);
        } finally {
          if (mounted) setLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, []);


  const handleDelete = async (id) => {
    if (!window.confirm('이 게시글을 삭제하시겠어요?')) return;
    try {
      await axios.delete(`/api/mates/${id}`);
      const next = items.filter((p) => p.id !== id);
      setItems(next);
      onCountChange && onCountChange(next.length);
    } catch (e) {
      alert(e.response?.data?.error || '삭제에 실패했습니다.');
    }
  };

  if (loading)
    return (
      <div className="rounded-2xl border bg-white p-6 text-sm text-zinc-500 shadow-sm">
        로딩 중...
      </div>
    );

  if (!items.length) {
    return (
      <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
        <div className="mb-2 text-sm font-medium text-zinc-900">
          등록한 메이트 게시글이 없어요
        </div>
        <div className="mb-4 text-xs text-zinc-500">
          새로운 게시글을 작성해보세요
        </div>
        <Link
          to="/mate/new"
          className="inline-flex rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          메이트 글 작성하기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((p) => (
        <div
          key={p.id}
          className="rounded-xl border bg-white p-4 shadow-sm hover:shadow"
        >
          <div className="mb-1 text-sm font-semibold text-zinc-900">
            {p.title || '제목 없음'}
          </div>
          <div className="text-xs text-zinc-500">
            {p.location || p.region || '-'}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link
              to={`/mate/${p.id}`}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-zinc-700 hover:bg-zinc-50"
            >
              게시글 열기
            </Link>
            <button
              onClick={() => handleDelete(p.id)}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-zinc-700 hover:bg-zinc-50"
            >
              삭제
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// 4) 프로필 수정 탭 (닉네임/소개/아바타 + 이메일/비밀번호 변경 + 회원탈퇴)
function ProfileEditSection({
  profile,
  setProfile,
  nickState,
  onSaveProfile,
  saving,
  avatarPreview,
  fileRef,
  onPickImage,
  onFileChange,
  isKakaoCreated,
  isLinked,
  onGoEmailChange,
  onGoPasswordChange,
  onLinkKakao,
  onDelete,
}) {
  return (
    <div
      id="profile-edit-section"
      className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
    >
      {/* 프로필 수정 폼 */}
      <div>
        <div className="mb-4 text-base font-semibold text-zinc-900">
          프로필 수정
        </div>

        <form onSubmit={onSaveProfile}>
          <label className="mb-2 block text-sm text-zinc-700">닉네임</label>
          <input
            type="text"
            value={profile.nickname}
            onChange={(e) =>
              setProfile((p) => ({ ...p, nickname: e.target.value }))
            }
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            placeholder="닉네임"
          />
          {(nickState.msg || nickState.checking) && (
            <div
              className={`mt-1 text-xs ${
                nickState.valid ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {nickState.checking ? '중복 확인 중…' : nickState.msg}
            </div>
          )}

          <label className="mb-2 mt-4 block text-sm text-zinc-700">
            인사문구 / 소개 (bio)
          </label>
          <textarea
            rows={4}
            value={profile.bio}
            onChange={(e) =>
              setProfile((p) => ({ ...p, bio: e.target.value }))
            }
            className="mb-4 w-full resize-none rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            placeholder="간단한 자기소개를 작성해보세요"
          />

          <label className="mb-2 block text-sm text-zinc-700">
            프로필 이미지
          </label>
          <div className="mb-6 flex items-center gap-3">
            <img
              src={
                avatarPreview ||
                profile.avatarUrl ||
                '/assets/avatar_placeholder.png'
              }
              alt="avatar-mini"
              className="h-10 w-10 rounded-full object-cover ring-1 ring-zinc-200"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={onPickImage}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <Camera className="h-4 w-4" /> 이미지 변경
            </button>
          </div>

          <button
            type="submit"
            disabled={saving || !nickState.valid || nickState.checking}
            className="inline-flex rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </form>
      </div>

      {/* 계정 관리 카드 */}
      <div className="rounded-2xl border bg-zinc-50 p-4">
        <div className="mb-3 text-sm font-semibold text-zinc-900">
          계정 관리
        </div>

        <RowItem
          title="이메일 변경"
          desc={
            isKakaoCreated
              ? '카카오로 만든 계정은 이메일 변경이 불가해요'
              : '현재 비밀번호 확인 후 새 이메일을 인증해 변경합니다'
          }
          actionLabel={
            isKakaoCreated ? (
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3.5 w-3.5" /> 사용 불가
              </span>
            ) : (
              '변경하기'
            )
          }
          onAction={!isKakaoCreated ? onGoEmailChange : undefined}
          disabled={isKakaoCreated}
        />

        <RowItem
          title="비밀번호 변경"
          desc="보안을 위해 정기적으로 비밀번호를 변경하세요."
          actionLabel={
            isKakaoCreated ? (
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3.5 w-3.5" /> 사용 불가
              </span>
            ) : (
              '변경하기'
            )
          }
          onAction={!isKakaoCreated ? onGoPasswordChange : undefined}
          disabled={isKakaoCreated}
        />

        <div className="flex items-center justify-between border-t py-4">
          <div>
            <div className="text-sm font-medium text-zinc-800">카카오 연동</div>
            <div className="text-xs text-zinc-500">
              카카오 계정으로 간편 로그인
            </div>
          </div>
          {isLinked ? (
            <button
              disabled
              className="rounded-md border px-3 py-1.5 text-sm text-green-700 bg-green-50 cursor-default"
            >
              연동중
            </button>
          ) : (
            <button
              onClick={onLinkKakao}
              className="rounded-md border px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              연동하기
            </button>
          )}
        </div>

        {profile.role === 'admin' && (
          <div className="mt-4 rounded-lg border border-dashed p-3">
            <div className="mb-1 text-sm font-medium text-zinc-800">
              관리자 권한
            </div>
            <div className="mb-2 text-xs text-zinc-600">
              관리자 페이지에 접근할 수 있습니다
            </div>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-white hover:bg-zinc-900"
            >
              관리자 페이지 이동 <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {/* 위험 영역 (회원탈퇴) */}
      <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
        <div className="mb-1 text-sm font-semibold text-red-700">
          위험 영역
        </div>
        <div className="text-xs text-red-500">
          계정 삭제는 복구할 수 없습니다.
        </div>
        <button
          onClick={onDelete}
          className="mt-3 rounded-md border border-red-200 px-4 py-2 text-xs text-red-600 hover:bg-red-100"
        >
          계정 삭제 요청
        </button>
      </div>
    </div>
  );
}
