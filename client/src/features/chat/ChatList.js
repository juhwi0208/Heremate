//client\src\features\chat\ChatList.js  
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ChatList = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const fetchRooms = async () => {
      try {
        const res = await axios.get('/api/chats/rooms', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRooms(res.data || []);
      } catch (err) {
        console.error('채팅방 목록 로드 실패:', err);
        setRooms([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold mb-6">내 채팅</h2>
        <div className="space-y-3">
          <div className="h-16 bg-gray-100 animate-pulse rounded" />
          <div className="h-16 bg-gray-100 animate-pulse rounded" />
          <div className="h-16 bg-gray-100 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h2 className="text-2xl font-bold mb-6">내 채팅</h2>
      {rooms.length === 0 ? (
        <p className="text-sm text-gray-500">참여 중인 채팅방이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              onClick={() => navigate(`/chat/${room.id}`)}
              className="group border rounded-xl p-4 bg-white/90 backdrop-blur shadow-sm hover:shadow-md cursor-pointer transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center text-green-700 font-semibold">
                  #{room.id}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">방 #{room.id}</span>
                    {room.post_id && <span className="text-[11px] text-gray-500">· 게시글 #{room.post_id}</span>}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {room.created_at ? new Date(room.created_at).toLocaleString() : ''}
                  </div>
                </div>
                {Number(room.unread_count) > 0 && (
                  <span className="min-w-6 h-6 px-2 inline-flex items-center justify-center text-white text-xs font-semibold bg-red-500 rounded-full">
                    {room.unread_count}
                  </span>
                )}
              </div>
            </div>

          ))}
        </div>
      )}
    </div>
  );
};

export default ChatList;
