// client/src/pages/MyPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, BookOpen, Megaphone, Settings as SettingsIcon, ChevronRight, Camera } from "lucide-react";
import axios from "../api/axiosInstance";

/**
 * HereMate MyPage
 * - Matches the provided UI screenshot: left sidebar nav, profile header card, profile edit card, account management card
 * - Excludes: Plans, Chats, Alerts (per latest scope)
 * - Sections: 프로필, 여행 스토리, 메이트 게시글, 설정(기본 계정/보안 모음)
 *
 * Styling Notes:
 * - Colors: primary green-600, neutrals zinc
 * - Cards: rounded-2xl, soft shadow on hover, 4-based spacing
 * - Responsive: desktop (sidebar + content 2-col), mobile (top tabs)
 */

const NAV = [
  { key: "profile", label: "프로필", icon: User },
  { key: "stories", label: "여행 스토리", icon: BookOpen },
  { key: "mates", label: "메이트 게시글", icon: Megaphone },
  { key: "settings", label: "설정", icon: SettingsIcon },
];

export default function MyPage({ setUser }) {
  const navigate = useNavigate();
  const [active, setActive] = useState("profile");

  // 기본 프로필 데이터
  const [profile, setProfile] = useState({
    id: null,
    nickname: "",
    email: "",
    joinedAt: "",
    role: "user",
    bio: "",
    avatarUrl: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // For previewing image uploads
  const fileRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        // Try to load my profile; fallback-friendly fields
        const { data } = await axios.get("/api/users/me");
        if (!mounted) return;
        setProfile((p) => ({
          ...p,
          id: data?.id ?? p.id,
          nickname: data?.nickname ?? p.nickname,
          email: data?.email ?? p.email,
          joinedAt: data?.created_at || data?.joinedAt || p.joinedAt,
          role: data?.role ?? p.role,
          bio: data?.bio ?? "",
          avatarUrl: data?.avatarUrl ?? "",
        }));
      } catch (e) {
        // Graceful fallback — keep page working even if /me is not ready
        console.warn("/api/users/me fetch failed; rendering with minimal info.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onPickImage = () => fileRef.current?.click();
  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const onSaveProfile = async (e) => {
    e?.preventDefault();
    if (saving) return;
    try {
      setSaving(true);
      const form = new FormData();
      form.append("nickname", profile.nickname || "");
      form.append("bio", profile.bio || "");
      if (fileRef.current?.files?.[0]) {
        form.append("avatar", fileRef.current.files[0]);
      }
      const { data } = await axios.put("/api/users/me", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("프로필이 저장되었습니다.");

      const newUrl = data?.avatarUrl || avatarPreview;  // 서버값 우선
        if (newUrl) {
          // 로컬 상태
          setProfile((p) => ({ ...p, avatarUrl: newUrl }));
        }

        // 전역 상태(헤더 반영)
        if (typeof setUser === "function") {
          setUser((u) => ({
            ...u,
            nickname: profile.nickname,
            avatarUrl: newUrl || u?.avatarUrl,
          }));
        }

    } catch (err) {
      console.error(err);
      alert("프로필 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };


  const content = useMemo(() => {
    switch (active) {
      case "profile":
        return (
          <div className="space-y-6">
            {/* 헤더 카드 */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <img
                    src={avatarPreview || profile.avatarUrl || "/assets/avatar_placeholder.png"}
                    alt="avatar"
                    className="h-16 w-16 rounded-full object-cover ring-1 ring-zinc-200"
                  />
                  <div>
                    <div className="text-lg font-semibold text-zinc-900">{profile.nickname || "사용자"}</div>
                    <div className="text-sm text-zinc-600">{profile.email || "-"}</div>
                    <div className="text-xs text-zinc-500">가입일: {profile.joinedAt || "-"}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const el = document.getElementById("profile-edit");
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="rounded-md border px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  프로필 수정
                </button>
              </div>
            </div>

            {/* 프로필 수정 카드 */}
            <form id="profile-edit" onSubmit={onSaveProfile} className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 text-base font-semibold text-zinc-900">프로필 수정</div>

              <label className="mb-2 block text-sm text-zinc-700">닉네임</label>
              <input
                type="text"
                value={profile.nickname}
                onChange={(e) => setProfile((p) => ({ ...p, nickname: e.target.value }))}
                className="mb-4 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                placeholder="닉네임"
              />

              <label className="mb-2 block text-sm text-zinc-700">소개 (선택)</label>
              <textarea
                rows={4}
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                className="mb-4 w-full resize-none rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                placeholder="간단한 자기소개를 작성해보세요"
              />

              <label className="mb-2 block text-sm text-zinc-700">프로필 이미지</label>
              <div className="mb-6 flex items-center gap-3">
                <img
                  src={avatarPreview || profile.avatarUrl || "/assets/avatar_placeholder.png"}
                  alt="avatar-mini"
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-zinc-200"
                />
                <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
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
                disabled={saving}
                className="inline-flex rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </form>

            {/* 계정 관리 카드 */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 text-base font-semibold text-zinc-900">계정 관리</div>

              <RowItem
                title="비밀번호 변경"
                desc="보안을 위해 정기적으로 비밀번호를 변경하세요"
                actionLabel="변경하기"
                onAction={() => navigate("/forgot-password")}
              />

              <RowItem
                title="카카오 연동"
                desc="카카오 계정으로 간편 로그인"
                actionLabel="연동하기"
                onAction={() => {
                  const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
                  window.location.href = `${API}/auth/kakao/start`;
                }}
              />

              {profile.role === "admin" && (
                <div className="mt-6 rounded-lg border border-dashed p-4">
                  <div className="mb-2 text-sm font-medium text-zinc-800">관리자 권한</div>
                  <div className="mb-3 text-sm text-zinc-600">관리자 페이지에 접근할 수 있습니다</div>
                  <Link to="/admin" className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-900">
                    관리자 페이지 이동 <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        );

      case "stories":
        return <StoriesSection />;

      case "mates":
        return <MatesSection />;

      case "settings":
        return <SettingsSection onGoPW={() => navigate("/forgot-password")} />;

      default:
        return null;
    }
  }, [active, avatarPreview, navigate, profile, saving]);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-6">
      {/* 상단 페이지 타이틀 */}
      <h1 className="mb-6 text-center text-lg font-semibold text-zinc-900 md:text-xl">마이페이지</h1>

      <div className="grid grid-cols-12 gap-6">
        {/* 좌측 사이드바 */}
        <aside className="col-span-12 md:sticky md:top-24 md:col-span-3">
          <nav className="rounded-2xl border bg-white p-2 shadow-sm">
            {NAV.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-zinc-50 ${
                  active === key ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-700"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* 우측 콘텐츠 */}
        <main className="col-span-12 md:col-span-9">
          {loading ? (
            <div className="rounded-2xl border bg-white p-6 text-sm text-zinc-500 shadow-sm">로딩 중...</div>
          ) : (
            content
          )}
        </main>
      </div>
    </div>
  );
}

function RowItem({ title, desc, actionLabel, onAction }) {
  return (
    <div className="flex items-center justify-between border-t py-4 first:border-t-0">
      <div>
        <div className="text-sm font-medium text-zinc-800">{title}</div>
        <div className="text-xs text-zinc-500">{desc}</div>
      </div>
      <button onClick={onAction} className="rounded-md border px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50">
        {actionLabel}
      </button>
    </div>
  );
}

/**
 * 여행 스토리 섹션 (간단 골격)
 * - 카드 그리드(이미지, 제목, 작성일)
 * - Hover 시 액션 노출(열기/수정/삭제/공개 전환) — 추후 확장
 */
function StoriesSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await axios.get("/api/stories?me=1");
        if (!mounted) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="rounded-2xl border bg-white p-6 text-sm text-zinc-500 shadow-sm">로딩 중...</div>;

  if (!items.length) {
    return (
      <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
        <div className="mb-2 text-sm font-medium text-zinc-900">아직 작성한 스토리가 없어요</div>
        <div className="mb-4 text-xs text-zinc-500">첫 여행 스토리를 작성해보세요</div>
        <Link to="/stories/new" className="inline-flex rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
          스토리 작성하기
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <article key={s.id} className="group overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="aspect-[4/3] w-full bg-zinc-100">
            {s.cover_url ? (
              <img src={s.cover_url} alt={s.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">No Image</div>
            )}
          </div>
          <div className="p-4">
            <div className="line-clamp-1 text-sm font-medium text-zinc-900">{s.title || "제목 없음"}</div>
            <div className="mt-1 text-xs text-zinc-500">{formatDate(s.created_at)}</div>
            <div className="mt-3 flex gap-2 opacity-0 transition group-hover:opacity-100">
              <Link to={`/stories/${s.id}`} className="rounded-md border px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50">열기</Link>
              <Link to={`/stories/${s.id}/edit`} className="rounded-md border px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50">수정</Link>
              <button className="rounded-md border px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50">삭제</button>
              <button className="rounded-md border px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50">공개 전환</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * 메이트 게시글 섹션 (간단 골격)
 * - 리스트 카드: 제목, 기간, 지역, 상태
 */
function MatesSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await axios.get("/api/mates?me=1");
        if (!mounted) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="rounded-2xl border bg-white p-6 text-sm text-zinc-500 shadow-sm">로딩 중...</div>;

  if (!items.length) {
    return (
      <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
        <div className="mb-2 text-sm font-medium text-zinc-900">등록한 메이트 게시글이 없어요</div>
        <div className="mb-4 text-xs text-zinc-500">새로운 게시글을 작성해보세요</div>
        <Link to="/mate/new" className="inline-flex rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
          메이트 글 작성하기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((p) => (
        <article key={p.id} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-900">{p.title}</div>
              <div className="mt-1 text-xs text-zinc-500">
                {fmtDateRange(p.start_date, p.end_date)} · {p.location || "지역 미정"}
              </div>
            </div>
            <div className="flex gap-2">
              <Link to={`/mate/${p.id}`} className="rounded-md border px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">열기</Link>
              <Link to={`/mate/${p.id}/edit`} className="rounded-md border px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">수정</Link>
              <button className="rounded-md border px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">삭제</button>
              <button className="rounded-md border px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">마감</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * 설정 섹션(선택): 비밀번호 변경/연동 관리의 별도 정리
 */
function SettingsSection({ onGoPW }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4 text-base font-semibold text-zinc-900">계정 설정</div>
        <RowItem title="비밀번호 변경" desc="정기적으로 변경을 권장합니다" actionLabel="변경하기" onAction={onGoPW} />
        <RowItem
          title="카카오 연동"
          desc="카카오로 간편 로그인"
          actionLabel="연동하기"
          onAction={() => {
            const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
            window.location.href = `${API}/auth/kakao/start`;
          }}
        />
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-2 text-base font-semibold text-zinc-900">위험 영역</div>
        <div className="text-xs text-zinc-500">계정 삭제는 복구할 수 없습니다.</div>
        <button className="mt-4 rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50">계정 삭제 요청</button>
      </div>
    </div>
  );
}

// Helpers
function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function fmtDateRange(s, e) {
  const a = formatDate(s);
  const b = formatDate(e);
  if (a === "-" && b === "-") return "기간 미정";
  if (a !== "-" && b !== "-") return `${a} ~ ${b}`;
  return a !== "-" ? `${a} ~` : `~ ${b}`;
}

