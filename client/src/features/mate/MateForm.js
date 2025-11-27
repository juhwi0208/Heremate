// client/src/features/mate/MateForm.js
import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CountryCitySelect, { countryCityToLocation } from '../../components/CountryCitySelect';
import axios from '../../api/axiosInstance';

// 여행 취향 옵션(칩)
const STYLE_OPTIONS = ['자연','맛집','사진','쇼핑','예술','역사','체험','축제','휴식'];

export default function MateForm() {
  const navigate = useNavigate();

  // 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [region, setRegion] = useState(null);
  const [styles, setStyles] = useState([]); // 다중 선택(최대 3)

  // placeholder 유지 위해 focus 시 type을 date로 전환
  const [startType, setStartType] = useState('text');
  const [endType, setEndType] = useState('text');

  // ✅ 추가: 중복 제출 방지용
  const [submitting, setSubmitting] = useState(false);

  const TITLE_MAX = 100;
  const CONTENT_MAX = 1000;

  const canSubmit = useMemo(() => {
    
    return !submitting && title.trim() && startDate && endDate && countryCityToLocation(region) && styles.length > 0;
  }, [title, startDate, endDate, region, styles, submitting]);

  const toggleStyle = (v) => {
    setStyles((prev) => {
      const has = prev.includes(v);
      if (has) return prev.filter((x) => x !== v);
      if (prev.length >= 3) return prev;
      return [...prev, v];
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    
    if (!canSubmit) return;

    // ✅ 2차 방어: 아주 짧은 타이밍에도 중복 호출 막기
    if (submitting) return;
    setSubmitting(true);

    try {
      await axios.post('/api/posts', {
        title: title.trim(),
        content: content.trim(),
        start_date: startDate,
        end_date: endDate,
        location: countryCityToLocation(region),
        travel_style: styles.join(','),
      });
      navigate('/mate');
    } catch (err) {
      console.error('게시글 작성 실패:', err);
      alert(err?.response?.data?.error || '작성 실패: 로그인 상태/입력값을 확인하세요.');
    }
  };

  return (
    <div className="bg-gray-50">
      {/* ✅ 폼 전체 폭 2/3 수준으로 축소: 960px → 640px, 가운데 정렬 유지 */}
      <div className="mx-auto max-w-[690px] px-6 pt-10 pb-20">

        {/* 상단 경로 */}
        <div className="mb-4 text-[13px] text-slate-500">
          <Link to="/mate" className="hover:underline">메이트 찾기</Link>
          <span className="mx-2">›</span>
          <span className="text-slate-700">게시글 작성</span>
        </div>

        {/* ✅ 취소 버튼과 타이틀/설명을 같은 수평 라인에 배치 + 타이틀은 가운데 정렬 + 글자 크기 축소 */}
        <div className="mb-8 flex items-center justify-between">
          {/* 취소 버튼(왼쪽) */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-full border bg-white border-slate-300 text-[13px] text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 transition"
          >
            <span className="text-[16px] leading-none">←</span>
            취소하고 돌아가기
          </button>

          {/* 타이틀/설명(가운데) */}
          <div className="flex-1 text-center">
            <h1 className="text-[22px] font-bold text-slate-900">
              여행 메이트 모집하기
            </h1>
            <p className="text-[13px] text-slate-600 mt-1">
              함께 여행할 동행자를 찾기 위한 게시글을 작성해보세요
            </p>
          </div>

          {/* 오른쪽 공간 균형용(취소 버튼과 폭 맞추기 위해 빈 span) */}
          <span className="w-[120px] md:w-[140px]" aria-hidden="true"></span>
        </div>

        {/* 카드 컨테이너 */}
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
        >
          {/* 제목 */}
          <div className="px-7 pt-7">
            <label className="block text-[14px] font-semibold text-slate-700 mb-2">
              제목 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              placeholder="예: 제주도 힐링 여행 함께 하실 분!"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="mt-2 mb-4 text-right text-[12px] text-slate-400">
              {title.length}/{TITLE_MAX}자
            </div>
          </div>

          {/* 내용 */}
          <div className="px-7">
            <label className="block text-[14px] font-semibold text-slate-700 mb-2">
              여행 계획 및 설명 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, CONTENT_MAX))}
              rows={8}
              placeholder={[
                '여행 세부 내용을 작성해 주세요. 예를 들어:',
                '- 구체적인 여행 일정',
                '- 선호하는 숙소 타입',
                '- 예상 여행 경비',
                '- 함께 하고 싶은 활동',
                '- 원하는 동행자 조건 등',
              ].join('\n')}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="mt-2 text-right text-[12px] text-slate-400">
              {content.length}/{CONTENT_MAX}자
            </div>
          </div>

          {/* 날짜 */}
          <div className="px-7 mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[14px] font-semibold text-slate-700 mb-2">
                여행 시작일 <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={startType}
                  onFocus={() => setStartType('date')}
                  onBlur={() => !startDate && setStartType('text')}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="연도-월-일"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">📅</span>
              </div>
            </div>
            <div>
              <label className="block text-[14px] font-semibold text-slate-700 mb-2">
                여행 종료일 <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={endType}
                  onFocus={() => setEndType('date')}
                  onBlur={() => !endDate && setEndType('text')}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="연도-월-일"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">📅</span>
              </div>
            </div>
          </div>

          {/* 지역 */}
          <div className="px-7 mt-6">
            <label className="block text-[14px] font-semibold text-slate-700 mb-2">
              여행 지역 <span className="text-rose-500">*</span>
            </label>
            <CountryCitySelect
              value={region}
              onChange={setRegion}
              required
            />
            <p className="text-[12px] text-slate-500 mt-2">
              나라를 먼저 선택한 뒤 도시를 선택하세요.
            </p>
          </div>

          {/* 여행 취향(칩, 최대 3개) */}
          <div className="px-7 mt-6">
            <label className="block text-[14px] font-semibold text-slate-700 mb-3">
              여행 스타일 <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((opt) => {
                const active = styles.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleStyle(opt)}
                    className={[
                      'px-4 py-2 rounded-full text-[13px] border transition',
                      active
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-[12px] text-slate-500">
              최대 3개까지 선택 가능 (현재 {styles.length}개)
            </div>
          </div>

          {/* 제출 */}
          <div className="px-7 mt-8 mb-8">
            <button
              type="submit"
              disabled={!canSubmit}
              className={[
                'w-full md:w-auto rounded-full px-6 py-4 text-[15px] font-semibold shadow-md',
                canSubmit
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-200 text-white/80 cursor-not-allowed',
              ].join(' ')}
            >
              {submitting ? '등록 중...' : '✈️ 게시글 등록하기'}
            </button>
          </div>
        </form>

        {/* 하단 팁 박스 (원본과 동일 톤) */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-[#eef6ff] p-6 text-slate-800">
          <div className="text-[18px] font-bold mb-3">💡 좋은 게시글 작성 팁</div>
          <ul className="space-y-2 text-[15px]">
            <li>✓ 구체적인 여행 일정과 계획을 상세히 작성해주세요</li>
            <li>✓ 예상 여행 경비와 숙소 타입을 명시하면 좋아요</li>
            <li>✓ 원하는 동행자의 조건이나 성향을 적어주세요</li>
            <li>✓ 연락 방법이나 만날 장소를 미리 정해두면 편해요</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
