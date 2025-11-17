//C:\Users\owner\Documents\GitHub\Heremate\client\src\features\story\StoryDetail.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../../api/axiosInstance';


const FONT_SIZE_CLASS = {
  sm: 'text-xs md:text-sm',
  md: 'text-sm md:text-base',
  lg: 'text-base md:text-lg',
};

function StoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [story, setStory] = useState(null);
  const [media, setMedia] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    axios
      .get(`/api/stories/${id}`)
      .then((res) => {
        if (!mounted) return;
        const data = res.data;

        let parsedMedia = [];
        if (Array.isArray(data.media)) {
          parsedMedia = data.media;
        } else if (typeof data.media === 'string') {
          try {
            parsedMedia = JSON.parse(data.media) || [];
          } catch {
            parsedMedia = [];
          }
        }

        if ((!parsedMedia || parsedMedia.length === 0) && data.thumbnail_url) {
          parsedMedia = [
            {
              url: data.thumbnail_url,
              type: 'image',
              index: 0,
              caption: null,
            },
          ];
        }

        setStory(data);
        setMedia(parsedMedia);
        setCurrentIndex(0);
      })
      .catch((e) => {
        console.error(e);
        if (!mounted) return;
        alert('스토리를 불러오지 못했습니다.');
        navigate('/stories');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, navigate]);

  // 자동 슬라이드 (3초마다 다음 슬라이드)
  useEffect(() => {
    if (!isPlaying || media.length <= 1) return;

    const timer = setTimeout(() => {
      setCurrentIndex((prev) =>
        prev === media.length - 1 ? 0 : prev + 1
      );
    }, 3000);

    return () => clearTimeout(timer);
  }, [isPlaying, currentIndex, media.length]);

  // 페이드 인 효과: 슬라이드가 바뀔 때마다 다시 페이드
  useEffect(() => {
    setFadeIn(false);
    const t = setTimeout(() => setFadeIn(true), 30);
    return () => clearTimeout(t);
  }, [currentIndex, media.length]);

  const handlePrev = () => {
    if (!media.length) return;
    setCurrentIndex((prev) =>
      prev === 0 ? media.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    if (!media.length) return;
    setCurrentIndex((prev) =>
      prev === media.length - 1 ? 0 : prev + 1
    );
  };

  const handleReport = async () => {
    if (!story) return;
    const ok = window.confirm('이 스토리를 신고할까요?');
    if (!ok) return;

    try {
      setReporting(true);
      await axios.post(`/api/stories/${story.id}/report`, {
        reason: 'etc',
        severity: 1,
      });
      alert('신고가 접수되었습니다.');
    } catch (e) {
      console.error(e);
      if (e?.response?.status === 401) {
        alert('로그인이 필요합니다.');
      } else {
        alert('신고 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setReporting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500">
        스토리 불러오는 중...
      </div>
    );
  }

  if (!story) {
    return (
      <div className="p-6 text-sm text-gray-500">
        스토리를 찾을 수 없습니다.
      </div>
    );
  }

  const current = media[currentIndex] || null;
  const avatarUrl = story.avatar_url || story.avatarUrl || '';

  // 자막 위치 계산
  const getCaptionWrapperClass = (position) => {
    switch (position) {
      case 'top':
        return 'top-4';
      case 'center':
        return 'top-1/2 -translate-y-1/2';
      case 'bottom':
      default:
        return 'bottom-4';
    }
  };

  const caption = current?.caption || null;
  const captionHasText = caption && caption.text && caption.text.trim().length > 0;

  return (
    <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-6">
      {/* 왼쪽: 슬라이드 쇼 */}
      <div className="flex flex-col items-center">
        <div className="relative w-full max-w-md aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-md">
          {current ? (
            <div
              className={
                'w-full h-full transition-opacity duration-500 ' +
                (fadeIn ? 'opacity-100' : 'opacity-0')
              }
            >
              {current.type === 'video' ? (
                <video
                  key={current.url}
                  src={current.url}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  onPlay={() => setIsPlaying(false)}
                  onPause={() => setIsPlaying(true)}
                />
              ) : (
                <img
                  src={current.url}
                  alt={story.title}
                  className="w-full h-full object-cover"
                  onLoad={() => setFadeIn(true)}
                />
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 text-sm">
              <span>표시할 미디어가 없습니다.</span>
              <span className="text-[11px] mt-1">
                (업로드된 파일이 없거나, media 정보가 비어 있습니다.)
              </span>
            </div>
          )}

          {/* 자막 오버레이 */}
          {captionHasText && (
            <div
              className={
                'absolute inset-x-3 flex justify-center ' +
                getCaptionWrapperClass(caption.position)
              }
            >
              <div className="inline-block bg-black/50 px-3 py-1.5 rounded-lg max-w-[90%]">
                <p
                  className={
                    'whitespace-pre-line text-center font-medium ' +
                    (FONT_SIZE_CLASS[caption.fontSize] ||
                      FONT_SIZE_CLASS.md)
                  }
                  style={{ color: caption.color || '#ffffff' }}
                >
                  {caption.text}
                </p>
              </div>
            </div>
          )}

          {/* 좌우 네비게이션 버튼 */}
          {media.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  handlePrev();
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  handleNext();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg"
              >
                ›
              </button>
            </>
          )}

          {/* 페이지 인디케이터 */}
          {media.length > 1 && (
            <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
              {media.map((_, idx) => (
                <span
                  key={idx}
                  className={
                    'w-1.5 h-1.5 rounded-full ' +
                    (idx === currentIndex ? 'bg-white' : 'bg-white/40')
                  }
                />
              ))}
            </div>
          )}

          {/* 자동 재생 on/off (작은 토글 버튼) */}
          {media.length > 1 && (
            <button
              type="button"
              onClick={() => setIsPlaying((prev) => !prev)}
              className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-full bg-black/50 text-white"
            >
              {isPlaying ? '자동재생 ON' : '자동재생 OFF'}
            </button>
          )}
        </div>

        {/* 아래 미니 썸네일 리스트 */}
        {media.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {media.map((m, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIndex(idx);
                }}
                className={
                  'relative w-14 h-20 rounded-lg overflow-hidden border ' +
                  (idx === currentIndex
                    ? 'border-teal-500'
                    : 'border-transparent opacity-70')
                }
              >
                {m.type === 'video' ? (
                  <video
                    src={m.url}
                    className="w-full h-full object-cover pointer-events-none"
                    muted
                  />
                ) : (
                  <img
                    src={m.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 오른쪽: 작성자 + 제목/설명 + 신고 버튼 */}
      <div className="space-y-4">
        {/* 작성자/프로필 박스 (나중에 아우라/별자리 붙일 자리) */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl bg-teal-300/40" />
              <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 border border-white">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={story.nickname || '프로필'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                    no img
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold">
                  {story.nickname || '익명'}
                </span>
              </div>
              <p className="text-xs text-gray-500">Story ID #{story.id}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReport}
            disabled={reporting}
            className="text-xs px-3 py-1.5 rounded-full border border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-60"
          >
            {reporting ? '신고 중...' : '스토리 신고'}
          </button>
        </div>

        {/* 제목 / 설명 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <h2 className="text-lg font-bold">{story.title}</h2>
          {story.description && (
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {story.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default StoryDetail;
