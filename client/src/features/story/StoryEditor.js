// client\src\features\story\StoryEditor.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axiosInstance';

const createDefaultCaption = () => ({
  text: '',
  fontSize: 'md', // 'sm' | 'md' | 'lg'
  color: '#ffffff',
  position: 'bottom', // 'top' | 'center' | 'bottom'
});

const FONT_SIZE_LABEL = {
  sm: '작게',
  md: '보통',
  lg: '크게',
};

const POSITION_LABEL = {
  top: '위쪽',
  center: '가운데',
  bottom: '아래쪽',
};

const COLOR_PRESETS = [
  '#ffffff',
  '#000000',
  '#f97316', // 오렌지
  '#22c55e', // 초록
  '#3b82f6', // 파랑
  '#e11d48', // 핑크/레드
];

function StoryEditor() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [planId, setPlanId] = useState('');
  const [files, setFiles] = useState([]);
  const [captions, setCaptions] = useState([]);
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFilesChange = (e) => {
    const fileList = Array.from(e.target.files || []);
    setFiles(fileList);
    setThumbnailIndex(0);

    // 파일 개수에 맞춰 caption 배열도 재생성
    setCaptions(fileList.map(() => createDefaultCaption()));
  };

  const updateCaption = (index, patch) => {
    setCaptions((prev) => {
      const next = [...prev];
      next[index] = { ...(next[index] || createDefaultCaption()), ...patch };
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('제목을 입력해 주세요.');
      return;
    }
    if (!files.length) {
      setError('최소 1개 이상의 사진이나 동영상을 선택해 주세요.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    if (description.trim()) formData.append('description', description.trim());
    if (planId.trim()) formData.append('plan_id', planId.trim());
    formData.append('thumbnail_index', String(thumbnailIndex));

    // 슬라이드별 캡션 payload
    const captionsPayload = files.map((_, index) => ({
      index,
      ...(captions[index] || createDefaultCaption()),
    }));
    formData.append('captions', JSON.stringify(captionsPayload));

    files.forEach((file) => {
      formData.append('media', file);
    });

    try {
      setSubmitting(true);
      const res = await axios.post('/api/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newId = res.data?.id;
      if (newId) {
        navigate(`/stories/${newId}`);
      } else {
        navigate('/stories');
      }
    } catch (e) {
      console.error(e);
      if (e?.response?.status === 401) {
        setError('로그인이 필요합니다. 먼저 로그인 후 다시 시도해 주세요.');
      } else {
        setError('스토리 저장 중 오류가 발생했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const hasFiles = files && files.length > 0;

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-4">새 스토리 만들기</h1>

      <form
        onSubmit={handleSubmit}
        className="grid md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-6"
      >
        {/* 왼쪽: 미디어 & 프리뷰 & 슬라이드 자막 편집 */}
        <div className="space-y-4">
          {/* 파일 업로드 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              사진 / 동영상 업로드
            </label>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFilesChange}
              className="block w-full text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              여러 개를 선택하면 순서대로 스토리 슬라이드가 됩니다.
            </p>
          </div>

          {/* 미리보기 & 썸네일 선택 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-sm font-semibold mb-2">
              미리보기 & 대표 썸네일 선택
            </h2>

            {!hasFiles ? (
              <div className="text-xs text-gray-400">
                아직 선택된 미디어가 없습니다. 파일을 추가하면 여기에서 미리 볼 수 있어요.
              </div>
            ) : (
              <>
                {/* 메인 프리뷰 */}
                <div className="relative w-full max-w-md aspect-[9/16] bg-black rounded-2xl overflow-hidden mb-3">
                  {(() => {
                    const file = files[thumbnailIndex];
                    if (!file) return null;
                    const url = URL.createObjectURL(file);
                    const isVideo = file.type.startsWith('video');

                    return isVideo ? (
                      <video
                        src={url}
                        className="w-full h-full object-cover"
                        controls
                        muted
                      />
                    ) : (
                      <img
                        src={url}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    );
                  })()}

                  {/* (선택) 대표 캡션 미리보기도 여기에 나중에 얹을 수 있음 */}
                </div>

                {/* 썸네일 선택용 리스트 */}
                <div className="flex gap-2 overflow-x-auto">
                  {files.map((file, idx) => {
                    const url = URL.createObjectURL(file);
                    const isVideo = file.type.startsWith('video');
                    const isActive = idx === thumbnailIndex;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setThumbnailIndex(idx)}
                        className={
                          'relative w-16 h-24 rounded-lg overflow-hidden border ' +
                          (isActive
                            ? 'border-teal-500'
                            : 'border-transparent opacity-70')
                        }
                      >
                        {isVideo ? (
                          <video
                            src={url}
                            className="w-full h-full object-cover pointer-events-none"
                            muted
                          />
                        ) : (
                          <img
                            src={url}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                        {isActive && (
                          <span className="absolute bottom-1 left-1 right-1 text-[10px] text-center text-white bg-black/60 rounded px-1 py-0.5">
                            대표 썸네일
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 슬라이드별 자막/스타일 편집 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-sm font-semibold mb-2">
              슬라이드별 자막 & 스타일
            </h2>

            {!hasFiles ? (
              <div className="text-xs text-gray-400">
                미디어를 업로드하면 각 슬라이드에 자막과 스타일을 설정할 수 있어요.
              </div>
            ) : (
              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                {files.map((file, idx) => {
                  const url = URL.createObjectURL(file);
                  const isVideo = file.type.startsWith('video');
                  const cap = captions[idx] || createDefaultCaption();

                  return (
                    <div
                      key={idx}
                      className="flex gap-3 border border-gray-100 rounded-lg p-2"
                    >
                      <div className="w-16 h-24 rounded-md overflow-hidden bg-gray-200 flex-shrink-0">
                        {isVideo ? (
                          <video
                            src={url}
                            className="w-full h-full object-cover pointer-events-none"
                            muted
                          />
                        ) : (
                          <img
                            src={url}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">
                            슬라이드 #{idx + 1}
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">
                            자막 텍스트
                          </label>
                          <textarea
                            value={cap.text}
                            onChange={(e) =>
                              updateCaption(idx, { text: e.target.value })
                            }
                            rows={2}
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                            placeholder="이 슬라이드에 표시할 문장을 적어주세요."
                          />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {/* 폰트 크기 */}
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">
                              폰트 크기
                            </label>
                            <select
                              value={cap.fontSize}
                              onChange={(e) =>
                                updateCaption(idx, { fontSize: e.target.value })
                              }
                              className="rounded-md border border-gray-300 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500"
                            >
                              <option value="sm">{FONT_SIZE_LABEL.sm}</option>
                              <option value="md">{FONT_SIZE_LABEL.md}</option>
                              <option value="lg">{FONT_SIZE_LABEL.lg}</option>
                            </select>
                          </div>

                          {/* 위치 */}
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">
                              위치
                            </label>
                            <select
                              value={cap.position}
                              onChange={(e) =>
                                updateCaption(idx, {
                                  position: e.target.value,
                                })
                              }
                              className="rounded-md border border-gray-300 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500"
                            >
                              <option value="top">{POSITION_LABEL.top}</option>
                              <option value="center">
                                {POSITION_LABEL.center}
                              </option>
                              <option value="bottom">
                                {POSITION_LABEL.bottom}
                              </option>
                            </select>
                          </div>

                          {/* 색상 */}
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">
                              글자 색
                            </label>
                            <div className="flex gap-1">
                              {COLOR_PRESETS.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() =>
                                    updateCaption(idx, { color })
                                  }
                                  className={
                                    'w-5 h-5 rounded-full border ' +
                                    (cap.color === color
                                      ? 'border-teal-500 scale-110'
                                      : 'border-gray-300')
                                  }
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 메타데이터 입력 */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="예: 밴쿠버-LA 여행 하이라이트"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                설명 / 캡션
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="전체 스토리에 대한 설명을 적어주세요."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                연결할 여행 계획 ID (선택)
              </label>
              <input
                type="number"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="예: 12 (나중에 목록 선택으로 개선 예정)"
              />
              <p className="mt-1 text-xs text-gray-500">
                HereMate에서 만든 여행 계획과 연결해 두면,
                나중에 스토리에서 해당 일정으로 바로 이동할 수 있어요.
              </p>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => navigate('/stories')}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              disabled={submitting}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 disabled:opacity-60"
            >
              {submitting ? '저장 중...' : '스토리 저장'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default StoryEditor;
