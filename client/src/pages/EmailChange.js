// client/src/pages/EmailChange.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axiosInstance";
import { Eye, EyeOff } from "lucide-react";

export default function EmailChange() {
  const navigate = useNavigate();

  // 새로고침 대비: 단계 기억 키
  const flowKey = useMemo(() => "emflow-change", []);
  const [step, setStep] = useState(1); // 1: 본인 확인 → 2: 새 이메일 → 3: 코드 인증 → 4: 완료
  const setStepPersist = (n) => {
    setStep(n);
    sessionStorage.setItem(flowKey, String(n));
  };

  // 상태
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // 내 현재 이메일 표시 & 동일 이메일 방지
  const [currentEmail, setCurrentEmail] = useState("");

  // 입력 값
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");

  // mount 시: 단계 복원 + 내 이메일 조회
  useEffect(() => {
    const saved = sessionStorage.getItem(flowKey);
    if (saved && !Number.isNaN(Number(saved))) {
      setStep(Number(saved));
    }
    (async () => {
      try {
        const { data } = await axios.get("/api/users/me");
        setCurrentEmail(data?.email || "");
      } catch {
        // 메일 못가져와도 UI 동작에는 문제없음
      }
    })();
  }, [flowKey]);

  // 유효성
  const emailOk =
    !!newEmail &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) &&
    newEmail.trim().toLowerCase() !== (currentEmail || "").trim().toLowerCase();

  // 1) 본인 확인(로컬 이동)
  const goNextAfterPassword = () => {
    setError("");
    setMsg("");
    if (!password) {
      setError("현재 비밀번호를 입력해주세요.");
      return;
    }
    setStepPersist(2);
  };

  // 2) 새 이메일로 코드 요청
  const requestCode = async () => {
    setError("");
    setMsg("");
    if (!emailOk) {
      if (!newEmail) return setError("새 이메일을 입력해주세요.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return setError("올바른 이메일 형식이 아닙니다. 예: name@example.com");
      }
      if (newEmail.trim().toLowerCase() === (currentEmail || "").trim().toLowerCase()) {
        return setError("현재 이메일과 동일합니다. 다른 이메일을 입력해주세요.");
      }
    }
    try {
      setLoading(true);
      // 서버에서: 비번 검증 + 새 이메일 중복 확인 + 인증코드 발송
      await axios.post("/auth/email/request-code", { password, newEmail });
      setMsg("인증 코드가 새 이메일로 전송되었습니다.");
      setStepPersist(3);
    } catch (e) {
      setError(e.response?.data?.error || "코드 요청에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  // 3) 코드 검증 후 변경 확정
  const confirmChange = async () => {
    setError("");
    setMsg("");
    if (!code || code.length < 6) {
      return setError("6자리 인증 코드를 정확히 입력해주세요.");
    }
    try {
      setLoading(true);
      await axios.post("/auth/email/confirm", { newEmail, code });
      // 성공 처리
      setMsg("");
      setPassword("");
      setNewEmail("");
      setCode("");
      setShowPw(false);
      setStepPersist(4);
    } catch (e) {
      setError(e.response?.data?.error || "이메일 변경에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  // 엔터키: 단계별 기본 액션
  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (step === 1 && password) goNextAfterPassword();
    if (step === 2 && emailOk) requestCode();
    if (step === 3 && code && code.length >= 6) confirmChange();
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      {/* 페이지 헤더 */}
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900">이메일 변경</h1>

      {/* 단계 배지(완료 제외) */}
      {step !== 4 && (
        <ol className="mb-8 flex items-center gap-2 text-sm text-zinc-600">
          <li className={`rounded-full px-3 py-1 ${step >= 1 ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>1. 본인 확인</li>
          <span>›</span>
          <li className={`rounded-full px-3 py-1 ${step >= 2 ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>2. 새 이메일</li>
          <span>›</span>
          <li className={`rounded-full px-3 py-1 ${step >= 3 ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>3. 코드 인증</li>
        </ol>
      )}

      {/* 카드 */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm" onKeyDown={onKeyDown}>
        {/* 안내/에러 */}
        {msg ? <p className="mb-4 text-sm text-green-600">{msg}</p> : null}
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

        {/* 완료 화면 */}
        {step === 4 && (
          <div className="space-y-6 text-center">
            <p className="text-lg font-medium text-green-700">✅ 이메일 변경이 완료되었어요.</p>
            <p className="text-sm text-zinc-600">
              보안을 위해 다시 로그인이 필요할 수 있어요. 프로필의 이메일 표시는 새로고침 후 반영될 수 있습니다.
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => navigate("/mypage")}
                className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-900"
              >
                마이페이지로
              </button>
              <button
                onClick={() => navigate("/")}
                className="rounded-md border px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                홈으로
              </button>
            </div>
          </div>
        )}

        {/* 1단계: 비밀번호 확인 */}
        {step === 1 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-800">현재 비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="본인 인증을 위해 현재 비밀번호를 입력하세요."
                className="w-full rounded-md border border-zinc-200 px-3 pr-10 py-2 text-sm outline-none focus:border-green-600"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "비밀번호 가리기" : "비밀번호 보기"}
                aria-pressed={showPw}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-700"
              >
                {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              * 일반 로그인 사용자에 한해 필요합니다. 카카오 전용 계정은 별도 본인 확인 절차가 적용될 수 있어요.
            </p>
            <button
              type="button"
              onClick={goNextAfterPassword}
              disabled={loading || !password}
              className="mt-2 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              다음
            </button>
          </div>
        )}

        {/* 2단계: 새 이메일 입력 */}
        {step === 2 && (
          <div className="space-y-3">
            {currentEmail && (
              <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                현재 등록된 이메일: <span className="font-medium text-zinc-800">{currentEmail}</span>
              </div>
            )}

            <label className="block text-sm font-medium text-zinc-800">새 이메일</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="email"
              placeholder="로그인 및 알림 수신에 사용할 이메일 주소를 입력하세요. 예: name@example.com"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-600"
            />
            <p className="text-xs text-zinc-500">
              * 현재 이메일과 동일한 주소로는 변경할 수 없습니다. 정확한 주소인지 한번 더 확인해주세요.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStepPersist(1)}
                className="w-32 rounded-md border px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                이전 단계
              </button>
              <button
                type="button"
                onClick={requestCode}
                disabled={loading || !emailOk}
                className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {loading ? "전송 중..." : "인증 코드 보내기"}
              </button>
            </div>
          </div>
        )}

        {/* 3단계: 코드 인증 */}
        {step === 3 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-800">이메일로 받은 인증 코드</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="6자리 숫자 코드를 입력하세요"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-center text-sm tracking-widest outline-none focus:border-green-600"
            />
            <div className="text-xs text-zinc-500">
              * 메일이 오지 않았다면 스팸함을 확인하거나, 1~2분 후 다시 시도해 주세요.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStepPersist(2)}
                className="w-32 rounded-md border px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                이전 단계
              </button>
              <button
                type="button"
                onClick={confirmChange}
                disabled={loading || !code || code.length < 6}
                className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
              >
                {loading ? "확인 중..." : "변경 완료"}
              </button>
            </div>

            <div className="pt-2 text-xs text-zinc-500">
              코드 재전송이 필요하면{" "}
              <button
                type="button"
                onClick={requestCode}
                className="underline underline-offset-2 hover:text-zinc-800"
              >
                여기
              </button>
              를 눌러주세요.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
