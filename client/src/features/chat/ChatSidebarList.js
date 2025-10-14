// client/src/features/chat/ChatSidebarList.js
import React from 'react';

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  "http://localhost:4000";

const toAbs = (u) => {
  if (!u) return "";
  return /^https?:\/\//.test(u) ? u : `${API_BASE.replace(/\/$/, "")}${u}`;
};

export default function ChatSidebarList({ rooms = [], loading = false, selectedId, onSelect }) {
  if (loading) {
    return (
      <div className="p-3 space-y-2">
        <div className="h-12 bg-gray-100 animate-pulse rounded" />
        <div className="h-12 bg-gray-100 animate-pulse rounded" />
        <div className="h-12 bg-gray-100 animate-pulse rounded" />
      </div>
    );
  }

  if (!rooms.length) {
    return <div className="p-4 text-sm text-gray-500">참여 중인 채팅방이 없습니다.</div>;
  }

  return (
    <ul className="divide-y">
      {rooms.map(r => {
        const active = String(selectedId) === String(r.id);
        const avatar = toAbs(r.other_avatar_url);
        const initial = r.other_nickname?.slice(0,1)?.toUpperCase() || '#';

        return (
          <li
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition ${active ? 'bg-green-50' : ''}`}
          >
            <div className="flex items-center gap-3">
              {/* 1) 동그라미 → 상대 프로필 이미지 */}
              <div className="w-10 h-10 rounded-full bg-green-500/10 overflow-hidden flex items-center justify-center">
                {avatar
                  ? <img src={toAbs(avatar)} alt="상대 프로필" className="w-full h-full object-cover" />
                  : <span className="text-green-700 font-semibold">{initial}</span>}
              </div>

              {/* 2) 이름(닉네임 · 게시글제목) */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {r.other_nickname || `상대 사용자`}
                  </span>
                  {Number(r.unread_count) > 0 && (
                    <span className="ml-auto min-w-5 h-5 px-2 inline-flex items-center justify-center text-white text-[11px] font-semibold bg-red-500 rounded-full">
                      {r.unread_count}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {r.post_title ? r.post_title : (r.post_id ? `게시글 #${r.post_id}` : '개인 대화')}
                </div>

                {/* 4) 여행 지역/스타일 추가 표기 */}
                {(r.post_location || r.post_style) && (
                  <div className="text-[11px] text-gray-400 truncate mt-0.5">
                    {[r.post_location, r.post_style].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
