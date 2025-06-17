// src/pages/ChatRoom.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const mockMessages = [
  { id: 1, sender: '상대', text: '안녕하세요. 디즈니랜드 동행 구하시는 글 보고 연락드려요.', time: '8:00 PM' },
  { id: 2, sender: '나', text: '아 넵 안녕하세요.', time: '8:00 PM' },
  { id: 3, sender: '상대', text: '디즈니랜드로 9시쯤 출발하려고 하는데 괜찮으실까요?', time: '8:00 PM' },
  { id: 4, sender: '나', text: '넵 괜찮습니다. 돌아올 때도 같이 택시 타고 와도 될까요?', time: '8:01 PM' },
];

const ChatRoom = () => {
  const { id } = useParams();
  const [messages, setMessages] = useState(mockMessages);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage = {
      id: messages.length + 1,
      sender: '나',
      text: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([...messages, newMessage]);
    setInput('');
  };

  return (
    <div className="max-w-2xl mx-auto h-[80vh] flex flex-col border rounded shadow bg-white">
      <div className="px-4 py-3 border-b font-semibold text-green-700">채팅방 #{id}</div>

      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === '나' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`px-3 py-2 rounded-lg text-sm shadow max-w-xs ${
              msg.sender === '나'
                ? 'bg-green-200 text-right'
                : 'bg-white border'
            }`}>
              <p className="text-gray-800">{msg.text}</p>
              <div className="text-xs text-gray-400 mt-1">{msg.time}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t p-3 flex">
        <input
          type="text"
          className="flex-1 border rounded px-3 py-2 text-sm mr-2 focus:outline-none focus:ring focus:ring-green-300"
          placeholder="메시지 입력..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button
          onClick={handleSend}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
        >
          전송
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;
