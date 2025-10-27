import React from 'react';

export default function ThumbnailPicker({ open, images, onClose, onShuffle, onSelect, onSkip }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="text-lg font-semibold">대표 썸네일 선택</div>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded hover:bg-zinc-100">닫기</button>
        </div>

        <div className="p-5">
          {(!images || images.length === 0) ? (
            <div className="text-sm text-zinc-600">
              표시할 이미지가 없습니다. 장소에 등록된 사진이 없거나 권한 제한일 수 있어요.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {images.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelect(url)}
                    className="rounded-xl overflow-hidden border hover:scale-[1.01] transition shadow-sm"
                    title="이 이미지를 대표 썸네일로 사용"
                  >
                    <img src={url} alt={`thumb-${idx}`} className="w-full h-32 object-cover" />
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-[12px] text-zinc-500">
                  본 이미지들은 Google에 등록된 장소 사진이며, Google의 저작권/이용약관을 따릅니다.
                  이미지는 저장/재호스팅하지 않고 Google 서버에서 직접 불러옵니다.
                </p>
                <div className="flex gap-2">
                  <button onClick={onShuffle} className="px-3 py-1.5 rounded border">
                    다 마음에 안들어요
                  </button>
                  <button onClick={onSkip} className="px-3 py-1.5 rounded">
                    건너뛰기
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
