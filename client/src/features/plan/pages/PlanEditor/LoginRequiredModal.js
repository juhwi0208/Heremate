import React from 'react';

export default function LoginRequiredModal({ open, onClose, onLogin, onSignup }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold">로그인이 필요합니다</h3>
        <p className="text-sm text-zinc-600 mt-2">
          새 여행 계획을 만들려면 로그인 또는 회원가입이 필요해요.
        </p>
        <div className="mt-4 flex gap-2 justify-end">
          <button onClick={onLogin} className="px-3 py-1.5 rounded bg-green-600 text-white">로그인</button>
          <button onClick={onSignup} className="px-3 py-1.5 rounded border">회원가입</button>
          <button onClick={onClose} className="px-3 py-1.5 rounded">닫기</button>
        </div>
      </div>
    </div>
  );
}
