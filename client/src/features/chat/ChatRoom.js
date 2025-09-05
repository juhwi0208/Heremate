// client\src\features\chat\ChatRoom.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

export default function ChatRoom() {
  const { id: roomId } = useParams();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [since, setSince] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');
  const meId = token ? jwtDecode(token)?.id : null;

  // 메시지 불러오기 (증분 after 파라미터)
  useEffect(() => {
    let timer;

    const fetchMsgs = async () => {
      try {
        const url = since
          ? `/api/chats/rooms/${roomId}/messages?after=${encodeURIComponent(since)}`
          : `/api/chats/rooms/${roomId}/messages`;

        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (Array.isArray(res.data) && res.data.length) {
          setMsgs((prev) => [...prev, ...res.data]);
          setSince(res.data[res.data.length - 1].sent_at); // DB 컬럼명: sent_at
        }
      } catch (err) {
        console.error('메시지 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    // 최초 호출 + 폴링
    fetchMsgs();
    timer = setInterval(fetchMsgs, 3000);

    return () => clearInterval(timer);
  }, [roomId, since, token]);

  // 전송
  const send = async () => {
    if (!text.trim()) return;
    try {
      const res = await axios.post(
        `/api/chats/rooms/${roomId}/messages`,
        { content: text }, // 서버에서 content -> message로 매핑
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // 전송 직후 즉시 반영
      setMsgs((prev) => [...prev, res.data]);
      setSince(res.data.sent_at);
      setText('');
      // 스크롤 아래로
      requestAnimationFrame(scrollToBottom);
    } catch (err) {
      console.error('메시지 전송 실패:', err);
      alert('메시지 전송에 실패했습니다.');
    }
  };

  // Enter로 전송
  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  };

  // 새 메시지 렌더 후 자동 스크롤
  useEffect(() => {
    if (!loading) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs]);

  const scrollToBottom = () => {
    const box = document.querySelector('.chat-scroll-box');
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-[80vh] flex flex-col border rounded shadow bg-white">
      <div className="px-4 py-3 border-b font-semibold text-green-700">채팅방 #{roomId}</div>

      <div className="chat-scroll-box flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50">
        {loading && msgs.length === 0 ? (
          <>
            <div className="h-10 w-2/3 bg-gray-100 animate-pulse rounded" />
            <div className="h-10 w-1/2 bg-gray-100 animate-pulse rounded" />
            <div className="h-10 w-3/4 bg-gray-100 animate-pulse rounded" />
          </>
        ) : (
          msgs.map((m) => {
            const mine = meId && Number(m.sender_id) === Number(meId);
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`px-3 py-2 rounded-lg text-sm shadow max-w-xs ${
                    mine ? 'bg-green-200 text-right' : 'bg-white border'
                  }`}
                >
                  <p className="text-gray-800 whitespace-pre-wrap">{m.message}</p>
                  <div className="text-xs text-gray-400 mt-1">
                    {m.sent_at ? new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t p-3 flex">
        <input
          className="flex-1 border rounded px-3 py-2 text-sm mr-2 focus:outline-none focus:ring focus:ring-green-300"
          placeholder="메시지 입력..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          onClick={send}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
        >
          전송
        </button>
      </div>
    </div>
  );
}
