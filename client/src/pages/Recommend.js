// src/pages/Recommend.js
import React, { useEffect, useState } from 'react';
import { mockSpots } from '../data/mockSpots';

const Recommend = () => {
  const [spots, setSpots] = useState([]);

  useEffect(() => {
    // 실제로는 위치 기반 API로 대체
    setSpots(mockSpots);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h2 className="text-2xl font-bold mb-6 text-green-700">📍 현재 위치 기반 관광지 추천</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {spots.map(spot => (
          <div key={spot.id} className="border rounded-lg p-4 bg-white shadow hover:shadow-md">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">{spot.name}</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>🛣️ 거리: {spot.distance}km</li>
              <li>💰 가격: {spot.price}</li>
              <li>⏰ 운영시간: {spot.open}</li>
              <li>🅿️ 주차: {spot.parking ? '가능' : '불가'}</li>
              <li>🕒 관람 소요시간: {spot.duration}</li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Recommend;
