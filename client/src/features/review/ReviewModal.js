import { useState } from 'react';
import axios from '../../api/axiosInstance';

export default function ReviewModal({ open, onClose, tripId, targetUser }) {
  const [step, setStep] = useState(1);
  const [emotion, setEmotion] = useState(null); // 'positive','neutral','negative'
  const [tags, setTags] = useState([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const TAGS = {
    negative: [
      '시간 약속을 잘 지키지 않았어요',
      '대화가 불편하거나 공격적이었어요',
      '욕설/무례한 언행이 있었어요',
      '과도한 요구/요청이 많았어요',
      '금전적인 부분이 불명확했어요',
      '위생/청결 문제가 있었어요',
      '사진/동선 등 여행 스타일이 너무 안 맞았어요',
      '약속과 다른 행동이 많았어요'
    ],
    neutral: [
      '전체적으로 무난',
      '일정 조율 보통',
      '대화 보통',
      '스타일 약간 다름',
      '적당한 거리감',
      '일정 공유 보통',
      '기본 매너 OK',
    ],
    positive: [
      '시간 약속을 잘 지켰어요',
      '대화가 즐거웠어요',
      '배려심이 느껴졌어요',
      '사진/추억 남기기에 적극적이었어요',
      '여행 스타일이 잘 맞았어요',
      '금전적인 부분이 깔끔했어요',
      '위생/청결을 잘 지켰어요',
      '전반적으로 함께 있어서 편안했어요'
    ],
  };

  const toggleTag = (tag) => {
    if (tags.includes(tag)) {
      setTags(tags.filter((t) => t !== tag));
    } else {
      if (tags.length >= 3) return; // 최대 3개
      setTags([...tags, tag]);
    }
  };

  const submitReview = async () => {
    setLoading(true);
    try {
      await axios.post('/api/reviews', {
        trip_id: tripId,
        target_id: targetUser.id,
        emotion,
        tags,
        comment,
      });
      alert('후기가 제출되었습니다!');
      onClose();
    } catch (e) {
      console.error('review submit error', e);
      alert('후기 제출 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-[380px]">
        
        {/* STEP 1 */}
        {step === 1 && (
          <>
            <h2 className="text-xl font-bold mb-4">어떤 여행이었나요?</h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setEmotion('negative'); setStep(2); }}
                className="p-3 rounded-lg bg-red-100 hover:bg-red-200"
              >
                😞 별로예요
              </button>
              <button
                onClick={() => { setEmotion('neutral'); setStep(2); }}
                className="p-3 rounded-lg bg-gray-100 hover:bg-gray-200"
              >
                🙂 좋아요
              </button>
              <button
                onClick={() => { setEmotion('positive'); setStep(2); }}
                className="p-3 rounded-lg bg-green-100 hover:bg-green-200"
              >
                🥰 최고예요
              </button>
            </div>
          </>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <>
            <h2 className="text-xl font-bold mb-3">이유를 선택해주세요 (1~3개)</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {TAGS[emotion].map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-2 border rounded-full text-sm ${
                    tags.includes(tag)
                      ? 'bg-mint text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(3)}
              className="w-full py-2 bg-black text-white rounded-lg"
            >
              다음
            </button>
          </>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <>
            <h2 className="text-xl font-bold mb-3">코멘트 (선택)</h2>
            <textarea
              className="w-full h-32 border rounded-lg p-2 text-sm"
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="자세한 경험을 공유해주세요 (선택)"
            />
            <button
              onClick={submitReview}
              disabled={loading}
              className="mt-3 w-full py-2 bg-mint text-white rounded-lg disabled:bg-gray-300"
            >
              후기 제출하기
            </button>
          </>
        )}

      </div>
    </div>
  );
}
