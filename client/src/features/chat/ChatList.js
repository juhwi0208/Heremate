// client/src/features/chat/ChatList.js
import React, { useEffect, useState } from 'react';
import axios from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

const ChatList = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await axios.get('/api/chats/rooms'); // 헤더 자동 주입
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
          {rooms.map((room) => {
            const unreadCount = Number(room.unread_count) || 0;
            const hasUnread = unreadCount > 0;

            // 🔸 메이트 확정 / 동행 시작 관련 강한 알림 플래그 (백엔드에서 내려주도록)
            const hasTripAlert = !!room.has_trip_alert;

            const unreadLabel =
              unreadCount > 99 ? '99+' :
              unreadCount > 9 ? '9+' :
              unreadCount;

            return (
              <div
                key={room.id}
                onClick={() => navigate(`/chat/${room.id}`)}
                className={
                  `group rounded-xl p-4 bg-white/90 backdrop-blur shadow-sm hover:shadow-md cursor-pointer transition
                   border
                   ${hasTripAlert ? 'border-orange-300 ring-1 ring-orange-200'
                                  : 'border-gray-200'}`
                }
              >
                <div className="flex items-center gap-3">
                  {/* 왼쪽 동그란 아이콘: 트립 알림 있으면 색 강화 */}
                  <div
                    className={
                      `w-10 h-10 rounded-full flex items-center justify-center font-semibold
                       ${hasTripAlert
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-500/15 text-green-700'}`
                    }
                  >
                    #{room.id}
                  </div>

                  {/* 가운데 텍스트 영역 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        방 #{room.id}
                      </span>
                      {room.post_id && (
                        <span className="text-[11px] text-gray-500">
                          · 게시글 #{room.post_id}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 truncate">
                      {room.created_at
                        ? new Date(room.created_at).toLocaleString()
                        : ''}
                    </div>

                    {/* 🔥 메이트 확정 / 동행 시작 관련 강력 알림 태그 */}
                    {hasTripAlert && (
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-orange-50">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                        <span className="text-[11px] font-semibold text-orange-700">
                          메이트/동행 알림
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 오른쪽: 라이트 알림 - 일반 채팅 미읽음 뱃지 */}
                  {hasUnread && (
                    <span
                      className="min-w-6 h-6 px-2 inline-flex items-center justify-center
                                 text-white text-xs font-semibold
                                 bg-emerald-500 rounded-full"
                    >
                      {unreadLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChatList;
