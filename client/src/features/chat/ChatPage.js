// client/src/features/chat/ChatPage.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import ChatSidebarList from './ChatSidebarList';
import ChatRoom from './ChatRoom';

export default function ChatPage() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [currentId, setCurrentId] = useState(routeId || null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await axios.get('/api/chats/rooms');
        if (!alive) return;
        setRooms(Array.isArray(data) ? data : []);
        setRoomsLoading(false);
      } catch (e) {
        if (!alive) return;
        console.error('채팅방 목록 로드 실패:', e);
        setRooms([]);
        setRoomsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    // /chat/:id 면 해당 방을 열고, /chat 면 우측 비우기
    if (routeId !== currentId) {
      setCurrentId(routeId || null);
    }
  }, [routeId, currentId]);

  const onSelect = (id) => {
    const next = String(id);
    setCurrentId(next);
    navigate(`/chat/${next}`, { replace: false });
  };

  // 읽음 처리 후 사이드바 뱃지 0으로
  const handleRead = (roomId) => {
    setRooms(prev => prev.map(r => String(r.id) === String(roomId) ? { ...r, unread_count: 0 } : r));
  };

  const currentRoomMeta = rooms.find(r => String(r.id) === String(currentId));

  return (
    <div className="max-w-6xl mx-auto h-[78vh] mt-6 border rounded-xl overflow-hidden bg-white">
      <div className="h-full grid grid-cols-[320px_1fr]">
        <aside className="border-r bg-white">
          <div className="px-4 py-3 border-b font-semibold">Chat</div>
          <ChatSidebarList
            rooms={rooms}
            loading={roomsLoading}
            selectedId={currentId}
            onSelect={onSelect}
          />
        </aside>
        <section className="h-full">
          {currentId ? (
            <ChatRoom
              roomIdOverride={currentId}
              embed
              roomMeta={currentRoomMeta}
              onRead={handleRead}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              왼쪽에서 채팅방을 선택하세요.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
