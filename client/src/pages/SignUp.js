// client/src/pages/SignUp.js
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import axios from '../api/axiosInstance';

export default function SignUp() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: 이메일 → 2: 코드 → 3: 닉네임/비번 → 4: 완료
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // 폼 상태
  const [email, setEmail] = useState('');
  
  const [emailAvailable, setEmailAvailable] = useState(false);

  const [code, setCode] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);

  const [nickname, setNickname] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);

  // 1) 이메일 중복 확인
  const checkEmail = async () => {
    setErr(''); setMsg('');
    if (!emailValid) { setErr('올바른 이메일을 입력해 주세요.'); return; }
    try {
      setLoading(true);
      const { data } = await axios.get('/auth/check-email', { params: { email } });
      if (data.exists) {
         setEmailAvailable(false);
        setErr('이미 사용 중인 이메일입니다.');
      } else {
         setEmailAvailable(true);
        setMsg('사용 가능한 이메일입니다. 인증 코드를 보내세요.');
      }
    } catch {
      setErr('중복 확인 실패');
    } finally { setLoading(false); }
  };

  // 1) 인증 코드 보내기
  const sendCode = async () => {
    setErr(''); setMsg('');
    if (!emailAvailable) { setErr('이메일 중복 확인을 먼저 해주세요.'); return; }
    try {
      setLoading(true);
      await axios.post('/auth/signup/request-code', { email });
      setMsg('인증 코드가 이메일로 전송됐습니다.');
      setStep(2);
    } catch (e) {
      setErr(e.response?.data?.error || '코드 전송 실패');
    } finally { setLoading(false); }
  };

  // 2) 코드 인증
  const verifyCode = async () => {
    setErr(''); setMsg('');
    if (!code || code.length < 6) { setErr('6자리 코드를 입력해 주세요.'); return; }
    try {
      setLoading(true);
      await axios.post('/auth/signup/verify-code', { email, code });
      setCodeVerified(true);
      setMsg('이메일 인증이 완료되었습니다.');
      setStep(3);
    } catch (e) {
      setErr(e.response?.data?.error || '코드 인증 실패');
    } finally { setLoading(false); }
  };

  // 3) 가입 완료
  const submit = async (e) => {
    e?.preventDefault();
    setErr(''); setMsg('');
    if (!codeVerified) { setErr('이메일 인증을 먼저 완료해 주세요.'); return; }
    if (!nickname.trim()) { setErr('닉네임을 입력해 주세요.'); return; }
    if (pw.length < 8) { setErr('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (pw !== pw2) { setErr('비밀번호가 일치하지 않습니다.'); return; }

    try {
      setLoading(true);
      await axios.post('/auth/signup', { email: email.trim(), password: pw, nickname: nickname.trim() });
      setMsg('');
      setStep(4);
    } catch (e) {
      const c = e.response?.data?.code;
      if (c === 'EMAIL_TAKEN') setErr('이미 등록된 이메일입니다.');
      else if (c === 'NICK_TAKEN') setErr('이미 등록된 닉네임입니다.');
      else setErr(e.response?.data?.error || '회원가입 실패');
    } finally { setLoading(false); }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">회원가입</h2>

        {msg && <p className="mb-3 text-sm text-green-600">{msg}</p>}
        {err && <p className="mb-3 text-sm text-red-600">{err}</p>}

        {/* 완료 단계 */}
        {step === 4 ? (
          <div className="text-center space-y-6">
            <p className="text-lg font-medium text-green-700">✅ 가입이 완료되었습니다.</p>
            <button onClick={() => navigate('/login')} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              로그인하러 가기
            </button>
          </div>
        ) : (
          <>
            {/* 단계 배지 */}
            <ol className="mb-6 flex items-center gap-2 text-xs text-zinc-600">
              <li className={`rounded-full px-3 py-1 ${step >= 1 ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>1. 이메일</li>
              <span>›</span>
              <li className={`rounded-full px-3 py-1 ${step >= 2 ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>2. 코드 인증</li>
              <span>›</span>
              <li className={`rounded-full px-3 py-1 ${step >= 3 ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>3. 정보 입력</li>
            </ol>

            {/* STEP 1: 이메일 */}
            {step === 1 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">이메일</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailAvailable(false); }}
                  placeholder="you@example.com"
                />
                <div className="flex gap-2">
                  <Button type="button" onClick={checkEmail} disabled={loading || !emailValid}>중복 확인</Button>
                  <Button type="button" onClick={sendCode} disabled={loading || !emailAvailable}>인증 코드 보내기</Button>
                </div>
              </div>
            )}

            {/* STEP 2: 코드 인증 */}
            {step === 2 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">이메일로 받은 6자리 코드</label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="123456" />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>이전</Button>
                  <Button type="button" onClick={verifyCode} disabled={loading || code.length < 6}>코드 인증</Button>
                </div>
              </div>
            )}

            {/* STEP 3: 닉네임/비밀번호 */}
            {step === 3 && (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">닉네임</label>
                  <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">비밀번호 (8자 이상)</label>
                  <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">비밀번호 확인</label>
                  <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="비밀번호 확인" />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>이전</Button>
                  <Button type="submit" disabled={loading}>가입 완료</Button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
