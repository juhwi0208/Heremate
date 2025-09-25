// src/pages/MyPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, BookOpen, Megaphone, Settings as SettingsIcon, ChevronRight, Camera } from "lucide-react";
import axios from "../api/axiosInstance";

/* -----------------------------------------------------------
   ✅ [ADDED] 먼저 보조 컴포넌트들을 선언해서
   react/jsx-no-undef 경고가 절대 나지 않도록 함.
----------------------------------------------------------- */

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
 * ✅ [ADDED] SettingsSection를 최상단에 정의 (JSX 사용 위치보다 위)
 * - 이메일 변경(설정 탭)
 * - 카카오 연동 상태 "연동중" 표시
 * - 비밀번호 변경 링크
 */
function SettingsSection({ onGoPW, profile, onEmailUpdated }) {
  const [newEmail, setNewEmail] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");

  const API =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
    "";

  const handleSaveEmail = async () => {
    setMsg("");
    setErr("");
    if (!newEmail) return setErr("새 이메일을 입력해 주세요.");

    try {
      setSaving(true);
      const form = new FormData();
      form.append("email", newEmail);
      form.append("currentPassword", currentPassword);
      await axios.put("/api/users/me", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMsg("이메일이 변경되었습니다. 받은메일함에서 인증을 완료해 주세요.");
      setNewEmail("");
      setCurrentPassword("");
      if (typeof onEmailUpdated === "function") onEmailUpdated(newEmail);
    } catch (e) {
      setErr(e?.response?.data?.error || "이메일 변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4 text-base font-semibold text-zinc-900">계정 설정</div>

        {/* 이메일 변경 */}
        <div className="mb-3 text-sm font-medium text-zinc-800">이메일 변경</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="email"
            placeholder="새 이메일"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500"
          />
          <input
            type="password"
            placeholder="현재 비밀번호"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500"
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={handleSaveEmail}
            disabled={saving}
            className="rounded-md border px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            {saving ? "저장 중..." : "이메일 저장"}
          </button>
          <span className="text-xs text-zinc-500">
            저장 후 메일로 전송된 링크에서 인증을 완료해 주세요.
          </span>
        </div>
        {(msg || err) && (
          <div className={`mt-2 text-sm ${err ? "text-red-600" : "text-green-600"}`}>
            {err || msg}
          </div>
        )}

        {/* 카카오 연동 상태/버튼 */}
        <div className="flex items-center justify-between border-t py-4">
          <div>
            <div className="text-sm font-medium text-zinc-800">카카오 연동</div>
            <div className="text-xs text-zinc-500">카카오 계정으로 간편 로그인</div>
          </div>
          {profile?.kakaoId ? (
            <button
              disabled
              className="rounded-md border px-3 py-1.5 text-sm text-green-700 bg-green-50 cursor-default"
            >
              연동중
            </button>
          ) : (
            <button
              onClick={() => (window.location.href = `${API}/auth/kakao/start`)}
              className="rounded-md border px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              연동하기
            </button>
          )}
        </div>

        {/* 비밀번호 변경(찾기) */}
        <RowItem
          title="비밀번호 변경"
          desc="정기적으로 변경을 권장합니다"
          actionLabel="변경하기"
          onAction={onGoPW}
        />
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-2 text-base font-semibold text-zinc-900">위험 영역</div>
        <div className="text-xs text-zinc-500">계정 삭제는 복구할 수 없습니다.</div>
        <button className="mt-4 rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
          계정 삭제 요청
        </button>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------
   메인 컴포넌트
----------------------------------------------------------- */

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
    kakaoId: null,
    emailVerified: false,
  });

  // ✅ [ADDED] 닉네임 중복 검사 상태/원본 닉네임
  const originalNickRef = useRef("");
  const [nickState, setNickState] = useState({ checking: false, valid: true, msg: "" });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 이메일 수정 폼 상태
  const [emailForm, setEmailForm] = useState({ newEmail: "", currentPassword: "" });
  const [emailSaveMsg, setEmailSaveMsg] = useState("");

  // 이미지 업로드 프리뷰
  const fileRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
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
          kakaoId: data?.kakaoId ?? null,
          emailVerified: !!data?.emailVerified,
        }));
        // ✅ [ADDED] 원본 닉네임 저장
        if (data?.nickname) originalNickRef.current = data.nickname;
      } catch {
        console.warn("/api/users/me fetch failed; rendering with minimal info.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ [ADDED] 닉네임 디바운스 중복 검사 (버튼 없이 자동)
  useEffect(() => {
    const nick = profile.nickname?.trim();
    if (!nick) {
      setNickState({ checking: false, valid: false, msg: "닉네임을 입력해 주세요." });
      return;
    }
    if (nick === originalNickRef.current) {
      setNickState({ checking: false, valid: true, msg: "" });
      return;
    }

    setNickState((s) => ({ ...s, checking: true, msg: "" }));
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get("/auth/check-nickname", { params: { nickname: nick } });
        if (data.exists) {
          setNickState({ checking: false, valid: false, msg: "이미 사용 중인 닉네임입니다." });
        } else {
          setNickState({ checking: false, valid: true, msg: "" });
        }
      } catch {
        setNickState({ checking: false, valid: false, msg: "중복 확인 중 오류가 발생했습니다." });
      }
    }, 400);

    return () => clearTimeout(t);
  }, [profile.nickname]);

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

    // ✅ [ADDED] 닉네임 중복/검사중이면 저장 차단
    if (!nickState.valid || nickState.checking) {
      alert("닉네임 중복을 확인해 주세요.");
      return;
    }

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

      const newUrl = data?.avatarUrl || avatarPreview; // 서버 응답 우선
      if (newUrl) {
        setProfile((p) => ({ ...p, avatarUrl: newUrl }));
      }

      if (typeof setUser === "function") {
        setUser((u) => ({
          ...u,
          nickname: profile.nickname,
          avatarUrl: newUrl || u?.avatarUrl,
        }));
      }

      // ✅ [ADDED] 저장 성공 후 원본 닉네임 갱신
      originalNickRef.current = profile.nickname;
      alert("프로필이 저장되었습니다.");
    } catch (err) {
      console.error(err);
      alert("프로필 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const onChangeEmail = async () => {
    setEmailSaveMsg("");
    try {
      const payload = new FormData();
      payload.append("email", emailForm.newEmail);
      payload.append("currentPassword", emailForm.currentPassword);
      await axios.put("/api/users/me", payload);
      setEmailSaveMsg("이메일이 변경되었습니다. 받은메일함에서 인증을 완료해 주세요.");
      setProfile((p) => ({ ...p, email: emailForm.newEmail, emailVerified: false }));
      setEmailForm({ newEmail: "", currentPassword: "" });
    } catch (e) {
      const msg = e.response?.data?.error || "이메일 변경 실패";
      setEmailSaveMsg(msg);
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
                    <div className="text-sm text-zinc-600">
                      {profile.email || "-"}{" "}
                      <span className={`ml-1 text-xs ${profile.emailVerified ? "text-green-600" : "text-zinc-500"}`}>
                        {profile.emailVerified ? "(인증됨)" : "(미인증)"}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500">가입일: {fmtKoreanDate(profile.joinedAt) || "-"}</div>
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
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                placeholder="닉네임"
              />
              {/* ✅ [ADDED] 닉네임 중복 안내 */}
              {nickState.msg || nickState.checking ? (
                <div className={`mt-1 text-xs ${nickState.valid ? "text-green-600" : "text-red-600"}`}>
                  {nickState.checking ? "중복 확인 중…" : nickState.msg}
                </div>
              ) : null}

              <label className="mb-2 mt-4 block text-sm text-zinc-700">소개 (선택)</label>
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
                // ✅ [CHANGED] 닉네임 중복/검사 중이면 저장 불가
                disabled={saving || !nickState.valid || nickState.checking}
                className="inline-flex rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </form>

            {/* 계정 관리 카드 */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 text-base font-semibold text-zinc-900">계정 관리</div>

              {/* 이메일 변경 */}
              <div className="mb-3 text-sm font-medium text-zinc-800">이메일 변경</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="email"
                  placeholder="새 이메일"
                  value={emailForm.newEmail}
                  onChange={(e) => setEmailForm((f) => ({ ...f, newEmail: e.target.value }))}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
                <input
                  type="password"
                  placeholder="현재 비밀번호"
                  value={emailForm.currentPassword}
                  onChange={(e) => setEmailForm((f) => ({ ...f, currentPassword: e.target.value }))}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={onChangeEmail}
                  className="rounded-md border px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  이메일 저장
                </button>
                <span className="text-xs text-zinc-500">저장 후 메일로 전송된 링크에서 인증을 완료해 주세요.</span>
              </div>
              {emailSaveMsg && <div className="mt-2 text-xs text-zinc-600">{emailSaveMsg}</div>}

              {/* 비밀번호 변경(찾기) */}
              <RowItem
                title="비밀번호 변경"
                desc="보안을 위해 정기적으로 비밀번호를 변경하세요"
                actionLabel="변경하기"
                onAction={() => navigate("/forgot-password")}
              />

              {/* 카카오 연동 상태 */}
              <div className="flex items-center justify-between border-t py-4">
                <div>
                  <div className="text-sm font-medium text-zinc-800">카카오 연동</div>
                  <div className="text-xs text-zinc-500">카카오 계정으로 간편 로그인</div>
                </div>
                {profile.kakaoId ? (
                  <button
                    disabled
                    className="rounded-md border px-3 py-1.5 text-sm text-green-700 bg-green-50 cursor-default"
                  >
                    연동중
                  </button>
                ) : (
                  <button
                    onClick={() => (window.location.href = "/auth/kakao/start")}
                    className="rounded-md border px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    연동하기
                  </button>
                )}
              </div>

              {profile.role === "admin" && (
                <div className="mt-6 rounded-lg border border-dashed p-4">
                  <div className="mb-2 text-sm font-medium text-zinc-800">관리자 권한</div>
                  <div className="mb-3 text-sm text-zinc-600">관리자 페이지에 접근할 수 있습니다</div>
                  <Link
                    to="/admin"
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-900"
                  >
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
        return (
          <SettingsSection
            profile={profile}
            onEmailUpdated={(newEmail) =>
              setProfile((p) => ({ ...p, email: newEmail, emailVerified: false }))
            }
            onGoPW={() => navigate("/forgot-password")}
          />
        );

      default:
        return null;
    }
  }, [active, avatarPreview, navigate, profile, saving, emailForm, emailSaveMsg, nickState]);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-6">
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

/* -----------------------------------------------------------
   나머지 보조 섹션들
----------------------------------------------------------- */

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
      } catch {
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
            <div className="mt-1 text-xs text-zinc-500">{fmtKoreanDate(s.created_at)}</div>
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
      } catch {
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

/* -----------------------------------------------------------
   유틸
----------------------------------------------------------- */

function fmtKoreanDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}년 ${m}월 ${day}일`;
}

function fmtDateRange(s, e) {
  const a = fmtKoreanDate(s);
  const b = fmtKoreanDate(e);
  if (a === "-" && b === "-") return "기간 미정";
  if (a !== "-" && b !== "-") return `${a} ~ ${b}`;
  return a !== "-" ? `${a} ~` : `~ ${b}`;
}
