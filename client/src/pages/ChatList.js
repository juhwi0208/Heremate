// src/pages/ChatList.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

const mockChats = [
  {
    id: 1,
    nickname: '밥먹는 코알라',
    preview: '디즈니랜드로 9시쯤 출발하려고 하는데 괜찮으실까요?',
    date: '25.06.15',
    travelStyle: '테마파크'
  },
  {
    id: 2,
    nickname: '사과피파',
    preview: '천문대 보러 같이 가실 분 구합니다.',
    date: '25.03.10',
    travelStyle: '박물관'
  },
  {
    id: 3,
    nickname: '호랑이컴퓨터',
    preview: '할리우드 거리 같이 가실 분 구해요.',
    date: '25.05.10',
    travelStyle: '도심'
  }
];

const ChatList = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h2 className="text-2xl font-bold mb-6">내 채팅</h2>
      <div className="space-y-4">
        {mockChats.map(chat => (
          <div
            key={chat.id}
            onClick={() => navigate(`/chat/${chat.id}`)}
            className="border rounded-lg p-4 bg-white shadow hover:shadow-md cursor-pointer"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-green-700">{chat.nickname}</span>
              <span className="text-xs text-gray-400">{chat.date}</span>
            </div>
            <p className="text-sm text-gray-600 mb-1">{chat.preview}</p>
            <p className="text-xs text-gray-500">여행 스타일: {chat.travelStyle}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatList;
