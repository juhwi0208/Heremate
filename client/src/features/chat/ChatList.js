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
              className="border rounded-lg p-4 bg-white shadow hover:shadow-md cursor-pointer"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-green-700">방 #{room.id}</span>
                <span className="text-xs text-gray-400">
                  {room.created_at ? new Date(room.created_at).toLocaleString() : ''}
                </span>
              </div>
              {room.post_id && (
                <p className="text-xs text-gray-500">게시글 기반: #{room.post_id}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatList;
