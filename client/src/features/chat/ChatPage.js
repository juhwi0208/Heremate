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

  // URL이 바뀔 때마다 currentId 동기화
  useEffect(() => {
    setCurrentId(routeId || null);
  }, [routeId]);

  // 채팅방 목록 불러오기
  useEffect(() => {
    let alive = true;

    const fetchRooms = async () => {
      try {
        setRoomsLoading(true);
        const res = await axios.get('/api/chats/rooms');
        if (!alive) return;
        setRooms(res.data || []);
      } catch (err) {
        if (!alive) return;
        console.error('채팅방 목록 로드 실패:', err);
      } finally {
        if (alive) setRoomsLoading(false);
      }
    };

    fetchRooms();

    return () => {
      alive = false;
    };
  }, []);

  // 사이드바에서 방 클릭했을 때
  const handleSelectRoom = (id) => {
    if (!id) return;
    setCurrentId(id);
    navigate(`/chat/${id}`);
  };

  // 읽음 처리 후 사이드바 뱃지 제거
  const handleRead = (roomId) => {
    setRooms((prev) =>
      prev.map((r) =>
        Number(r.id) === Number(roomId) ? { ...r, unread_count: 0 } : r
      )
    );
  };

  const currentIdNum = currentId ? Number(currentId) : null;
  const currentRoomMeta = currentIdNum
    ? rooms.find((r) => Number(r.id) === currentIdNum)
    : null;

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-3">
      <div
        className="bg-white rounded-xl shadow-sm border
                  flex flex-col md:flex-row
                  h-[calc(100vh-6rem)] min-h-[520px]
                  overflow-hidden"
      >
        {/* 사이드바 */}
        <aside
          className="
            w-full md:w-[280px]
            border-b md:border-b-0 md:border-r
            flex-shrink-0
            max-h-56 md:max-h-none md:h-full
            overflow-y-auto
          "
        >
          <ChatSidebarList
            rooms={rooms}
            loading={roomsLoading}
            selectedId={currentIdNum}
            onSelect={handleSelectRoom}
          />
        </aside>

        {/* 채팅방 영역 */}
        <section className="flex-1 flex flex-col min-h-0">
          {currentIdNum ? (
            <ChatRoom
              key={currentIdNum}        // 다른 방으로 갈 때 강제 재마운트
              roomIdOverride={currentIdNum}
              embed
              roomMeta={currentRoomMeta}
              
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              왼쪽에서 채팅방을 선택하세요.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
