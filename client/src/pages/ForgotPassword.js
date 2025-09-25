// src/pages/ForgotPassword.js
import React, { useEffect, useMemo, useState } from "react";
import axios from "../api/axiosInstance";
import { Eye, EyeOff } from "lucide-react"; // 🟢 Added
import { useNavigate } from "react-router-dom"; // 🟢 추가


export default function ForgotPassword() {
  const navigate = useNavigate(); // 🟢 추가
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode"); // 'change' | null
  

  const title = useMemo(() => (mode === "change" ? "비밀번호 변경" : "비밀번호 찾기"), [mode]);

  // 단계/세션 키(새로고침 대비)
  const flowKey = useMemo(() => `pwflow-${mode || "find"}`, [mode]); // 🟢 Added

  const [step, setStep] = useState(1); // 1: 이메일 → 2: 코드 → 3: 새 비번
  const setStepPersist = (n) => {
    setStep(n);
    sessionStorage.setItem(flowKey, String(n)); // 🟢 Added
  };

  // 입력 값
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  // 🟢 Added: 비밀번호 보기 토글 상태
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  // 상태
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // 세션에 저장된 step 복원
  useEffect(() => {
    const saved = sessionStorage.getItem(flowKey);
    if (saved && !Number.isNaN(Number(saved))) {
      setStep(Number(saved));
    }
  }, [flowKey]);

  // 1) 이메일로 인증 코드 보내기
  const sendCode = async () => {
    setError("");
    setMsg("");
    try {
      setLoading(true);
      await axios.post("/auth/password/request-code", { email });
      setMsg("인증 코드가 이메일로 전송되었습니다.");
      setStepPersist(2);
    } catch (e) {
      setError(e.response?.data?.error || "코드 전송 실패");
    } finally {
      setLoading(false);
    }
  };

  // 2) 코드 검증
  const verifyCode = async () => {
    setError("");
    setMsg("");
    try {
      setLoading(true);
      await axios.post("/auth/password/verify-code", { email, code });
      setMsg("이메일 인증이 완료되었습니다. 새 비밀번호를 입력하세요.");
      setStepPersist(3);
    } catch (e) {
      setError(e.response?.data?.error || "인증 실패");
    } finally {
      setLoading(false);
    }
  };

  // 3) 비밀번호 변경
  const updatePassword = async () => {
    setError("");
    setMsg("");

    // 상세 분기 메시지  // 🟢 Added
    if (!pw1) {
      setError("새로운 비밀번호를 입력해주세요.");
      return;
    }
    if (pw1 !== pw2) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      setLoading(true);
      await axios.post("/auth/password/update", { email, code, newPassword: pw1 });

      // ✅ 완료 단계로 이동 (1 → 4 로 변경)
      setStepPersist(4);

      // 입력값 초기화
      setEmail("");
      setCode("");
      setPw1("");
      setPw2("");
      setShowPw1(false);
      setShowPw2(false);

      // 완료 화면은 step === 4 블록에서 고정 문구를 보여주므로 msg 비우기
      setMsg("");
    } catch (e) {
      setError(e.response?.data?.error || "비밀번호 변경 실패");
    } finally {
      setLoading(false);
    }
  };

  // 엔터 키 처리(각 단계 기본 액션)
  const onKeyDown = (evt) => {
    if (evt.key !== "Enter") return;
    if (step === 1 && email) sendCode();
    if (step === 2 && code.length >= 6) verifyCode();
    if (step === 3 && pw1 && pw2) updatePassword();
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      {/* 페이지 헤더 */}
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>

      {/* 단계 표시: 완료 단계는 따로 */}
      {step !== 4 && (
        <ol className="mb-8 flex items-center gap-2 text-sm text-zinc-600">
          <li className={`rounded-full px-3 py-1 ${step >= 1 ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>1. 이메일 입력</li>
          <span>›</span>
          <li className={`rounded-full px-3 py-1 ${step >= 2 ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>2. 코드 인증</li>
          <span>›</span>
          <li className={`rounded-full px-3 py-1 ${step >= 3 ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>3. 비밀번호 변경</li>
        </ol>
      )}

      {/* 카드 컨테이너(모달 아님 — 페이지 구성) */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm" onKeyDown={onKeyDown}>
        {/* 공통 안내/에러 */}
        {msg ? <p className="mb-4 text-sm text-green-600">{msg}</p> : null}
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}


        {/* STEP 4: 완료 안내 */}
        {step === 4 && (
          <div className="text-center space-y-6">
            <p className="text-lg font-medium text-green-700">✅ 비밀번호 변경이 완료 되었습니다.</p>
            <button
              onClick={() => navigate("/login")}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              로그인하러 가기
            </button>
          </div>
        )}

        {/* STEP 1: 이메일 */}
        {step === 1 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-800">가입한 이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-600"
            />
            <button
              type="button"
              onClick={sendCode}
              disabled={loading || !email}
              className="mt-2 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "전송 중..." : "이메일 인증하기"}
            </button>
          </div>
        )}

        {/* STEP 2: 코드 인증 */}
        {step === 2 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-800">이메일로 받은 인증 코드</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="6자리 코드"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-center text-sm tracking-widest outline-none focus:border-green-600"
            />
            <button
              type="button"
              onClick={verifyCode}
              disabled={loading || code.length < 6}
              className="mt-2 w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {loading ? "확인 중..." : "코드 인증"}
            </button>

            <div className="pt-2 text-xs text-zinc-500">
              메일을 받지 못했다면 스팸함을 확인하거나, 1분 후 다시 시도해 주세요.
            </div>
          </div>
        )}

        {/* STEP 3: 새 비밀번호 */}
        {step === 3 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-800">새 비밀번호</label>
            <div className="relative"> {/* 🟢 Added */}
              <input
                type={showPw1 ? "text" : "password"} // 🟢 Added
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                autoComplete="new-password"
                placeholder="새 비밀번호"
                className="w-full rounded-md border border-zinc-200 px-3 pr-10 py-2 text-sm outline-none focus:border-green-600" // 🟢 Changed: pr-10
              />
              <button
                type="button"
                onClick={() => setShowPw1((v) => !v)} // 🟢 Added
                aria-label={showPw1 ? "비밀번호 가리기" : "비밀번호 보기"}
                aria-pressed={showPw1}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-700"
              >
                {showPw1 ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />} {/* 🟢 Added */}
              </button>
            </div>

            <label className="mt-2 block text-sm font-medium text-zinc-800">새 비밀번호 확인</label>
            <div className="relative"> {/* 🟢 Added */}
              <input
                type={showPw2 ? "text" : "password"} // 🟢 Added
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
                placeholder="새 비밀번호 확인"
                className="w-full rounded-md border border-zinc-200 px-3 pr-10 py-2 text-sm outline-none focus:border-green-600" // 🟢 Changed: pr-10
              />
              <button
                type="button"
                onClick={() => setShowPw2((v) => !v)} // 🟢 Added
                aria-label={showPw2 ? "비밀번호 가리기" : "비밀번호 보기"}
                aria-pressed={showPw2}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-700"
              >
                {showPw2 ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />} {/* 🟢 Added */}
              </button>
            </div>

            <button
              type="button"
              onClick={updatePassword}
              disabled={loading || !pw1 || !pw2}
              className="mt-2 w-full rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
            >
              {loading ? "변경 중..." : "변경"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

