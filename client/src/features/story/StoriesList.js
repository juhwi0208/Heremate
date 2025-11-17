// client\src\features\story\StoryDetail.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../api/axiosInstance';

function StoriesList() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    axios
      .get('/api/stories')
      .then((res) => {
        if (!mounted) return;
        setStories(res.data || []);
      })
      .catch((e) => {
        console.error(e);
        if (!mounted) return;
        setError('스토리를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">스토리 불러오는 중...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">여행 스토리</h1>
        <Link
          to="/stories/new"
          className="px-3 py-1.5 rounded-full bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition"
        >
          + 새 스토리
        </Link>
      </div>

      {stories.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 bg-white rounded-xl shadow-sm">
          아직 등록된 스토리가 없어요.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {stories.map((s) => (
            <Link
              key={s.id}
              to={`/stories/${s.id}`}
              className="relative group rounded-xl overflow-hidden bg-gray-200 aspect-[9/16] shadow-sm"
            >
              {s.thumbnail_url && (
                <img
                  src={s.thumbnail_url}
                  alt={s.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-xs text-gray-200 mb-0.5 truncate">
                  {s.nickname || '익명'}
                </p>
                <p className="text-sm font-semibold text-white line-clamp-2">
                  {s.title}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default StoriesList;
