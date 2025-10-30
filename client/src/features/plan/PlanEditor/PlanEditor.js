// src/features/plan/PlanEditor/PlanEditor.js
import React, { useMemo, useState } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import ShareToggle from '../PlanList/ShareToggle';
import DayTabs from './DayTabs';
import DayCard from './DayCard';
import ThumbnailPicker from './ThumbnailPicker';
import LoginRequiredModal from './LoginRequiredModal';
import usePlanEditor from './UsePlanEditor';
import CountryCitySelect from '../../../components/CountryCitySelect';

export default function PlanEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);
  const isReadonly = location.pathname.endsWith('/readonly');

  const {
    title, setTitle, country, setCountry, region, setRegion,
    prefs, togglePref,
    start, end, handleStartChange, handleEndChange,
    days, setDays, activeIdx, setActiveIdx, isShared, setIsShared,
    loadError, loginGuard, setLoginGuard,
    isLoaded, onMapLoad, onMapUnmount,
    selectedEntryId, setSelectedEntryId,
    mapSearch, fetchMapPreds, mapPreds, detailCache,
    panToPred, addPredToCurrentDay, showOnMap,
    onDayDragOver, onDayDrop, addEntry, updateEntry, removeEntry,
    moveEntryUpDown, onDragStart,
    collectPhotoCandidates, doPersist,
  } = usePlanEditor({ isEdit, isReadonly, planId: id, seed: location.state?.seedPlan || null });

  const [thumbOpen, setThumbOpen] = useState(false);
  const [thumbPool, setThumbPool] = useState([]);
  const [thumbSix, setThumbSix] = useState([]);

  const pickRandom = (arr, n) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  };

  const onClickSave = async () => {
    if (isReadonly) return;
    const pool = await collectPhotoCandidates();
    setThumbPool(pool);
    setThumbSix(pickRandom(pool, Math.min(6, pool.length)));
    setThumbOpen(true);
  };

  const handleShuffleThumbs = () => setThumbSix(pickRandom(thumbPool, Math.min(6, thumbPool.length)));
  const onSelectThumbAndSave = async (urlOrNull) => { setThumbOpen(false); await doPersist(urlOrNull); };

  const selectedEntry = useMemo(() => {
    const d = days[activeIdx];
    if (!d) return null;
    return d.entries.find((e) => e.id === selectedEntryId) || null;
  }, [days, activeIdx, selectedEntryId]);

  const mapCenter =
    selectedEntry?.lat && selectedEntry?.lng
      ? { lat: Number(selectedEntry.lat), lng: Number(selectedEntry.lng) }
      : { lat: 35.6764, lng: 139.65 };

  const PREF_LABELS = ['자연','맛집','사진','쇼핑','예술','역사','체험','축제','휴식'];

  return (
    <div className="max-w-[1200px] mx-auto">

      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4">
        <button onClick={() => navigate('/plans')} className="text-sm text-zinc-600 hover:text-zinc-800">◀ 목록으로</button>
        <div className="px-4 py-1.5 rounded-full border border-green-600/30 bg-white shadow-sm flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600" />
          <span className="text-green-700 font-semibold">여행 계획 보드</span>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && !isReadonly && (
            <ShareToggle planId={id} initialShared={Boolean(isShared)} onChange={(v) => setIsShared(v ? 1 : 0)} />
          )}
          {!isReadonly && (
            <button onClick={onClickSave} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm shadow">
              저장
            </button>
          )}
        </div>
      </div>


      {/* 입력 폼 카드 (2,4) */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm mt-6 mx-4 md:mx-6 p-5">
        {/* 8그리드: 1/4씩=col-span-2, 1/8씩=col-span-1 */}
        <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
          <div className="md:col-span-2">
            <div className="text-xs text-zinc-500 mb-1">여행 제목</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 도쿄 벚꽃 여행" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-4">
            <div className="text-xs text-zinc-500 mb-1">여행 지역</div>
            <CountryCitySelect
              country={country}               // ✅ 값 바인딩
              region={region}                 // ✅ 값 바인딩
              onChangeCountry={(c) => {       // ✅ 변경 이벤트 연결
                setCountry(c);
                setRegion('');                // 나라 바뀌면 지역 초기화(기존 UX 유지)
              }}
              onChangeRegion={(r) => setRegion(r)}  // ✅ 지역 변경
            />
          </div>
          <div className="md:col-span-1">
            <div className="text-xs text-zinc-500 mb-1">시작일</div>
            <input type="date" value={start} onChange={(e) => handleStartChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-[11px]" />
          </div>
          <div className="md:col-span-1">
            <div className="text-xs text-zinc-500 mb-1">종료일</div>
            <input type="date" value={end} onChange={(e) => handleEndChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-[11px]" />
          </div>
        </div>

        {/* 취향(같은 카드 안, 한 줄 아래) */}
        <div className="mt-4">
          <div className="text-xs text-zinc-500 mb-1">여행 취향</div>
          <div className="flex flex-wrap gap-2">
            {PREF_LABELS.map((label) => (
              <button
                key={label}
                onClick={() => togglePref(label)}
                className={`px-3 py-1.5 rounded-full text-xs ${prefs.includes(label) ? 'bg-green-600 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Day 탭 */}
      <DayTabs days={days} activeIdx={activeIdx} onSelect={(i) => setActiveIdx(i)} />

      {/* 본문: 좌(활성 Day 하나) + 우(sticky) */}
      <div className="mx-4 md:mx-6 mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* (3) Day 탭 밑 전체를 하나의 흰 블럭으로 감싸기 */}
        <div className="bg-white border rounded-2xl shadow-sm p-4">
          {days[activeIdx] && (
            <DayCard
              key={days[activeIdx].date}
              day={days[activeIdx]}
              index={activeIdx}
              isReadonly={isReadonly}
              onDayDragOver={onDayDragOver}
              onDayDrop={onDayDrop}
              addEntry={addEntry}
              updateEntry={updateEntry}
              removeEntry={removeEntry}
              moveEntryUpDown={moveEntryUpDown}
              onDragStart={onDragStart}
              selectedEntryId={selectedEntryId}
              setSelectedEntryId={setSelectedEntryId}
              setDays={setDays}
              showOnMap={showOnMap}
            />
          )}
        </div>

        {/* 우: sticky 사이드(지도 + 추천) */}
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="bg-white border rounded-2xl shadow-sm p-4 mb-3">
            <input
              value={mapSearch}
              onChange={(e) => fetchMapPreds(e.target.value)}
              placeholder="장소, 주소, 카테고리로 검색하세요"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
              💡 장소명, 주소, 또는 카테고리(문화, 음식, 관광 등)로 검색할 수 있어요.
            </div>
          </div>

          <div className="bg-white border rounded-2xl shadow-sm p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl overflow-hidden border h-[360px]">
                {isLoaded ? (
                  <GoogleMap
                    onLoad={onMapLoad}
                    onUnmount={onMapUnmount}
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={mapCenter}
                    zoom={13}
                    options={{ fullscreenControl:false, streetViewControl:false, mapTypeControl:false, zoomControl:true }}
                  >
                    {selectedEntry?.lat && selectedEntry?.lng && (
                      <Marker position={{ lat: Number(selectedEntry.lat), lng: Number(selectedEntry.lng) }} />
                    )}
                  </GoogleMap>
                ) : (
                  <div className="w-full h-full grid place-items-center text-sm text-gray-500">지도 로드 중...</div>
                )}
              </div>

              <div className="h-[360px] overflow-y-auto pr-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm">추천 장소</div>
                  <div className="text-xs text-zinc-500">{mapPreds.length}개</div>
                </div>

                {(mapPreds || []).map((p) => {
                  const det = detailCache[p.place_id] || {};
                  return (
                    <div key={p.place_id} className="border rounded-lg p-2 mb-2 hover:shadow-sm">
                      <div className="flex gap-2">
                        {detailCache[p.place_id]?.photoUrl
                          ? <img src={detailCache[p.place_id].photoUrl} alt="thumb" className="w-20 h-20 object-cover rounded-xl" />
                          : <div className="w-20 h-20 bg-zinc-100 rounded-xl grid place-items-center text-xs text-zinc-400">NO IMG</div>}
                                                
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {detailCache[p.place_id]?.name
                              || p.structured_formatting?.main_text
                              || p.description}
                          </div>

                          <div className="text-xs text-zinc-500 truncate">
                            {det.address || p.structured_formatting?.secondary_text}
                          </div>
                          <div className="mt-1 flex gap-1">
                            <button onClick={() => addPredToCurrentDay(p)} className="px-2 py-1 text-[11px] rounded bg-green-600 text-white">일정추가</button>
                            <button onClick={() => panToPred(p)} className="px-2 py-1 text-[11px] rounded border">지도보기</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {mapPreds.length === 0 && (
                  <div className="text-xs text-zinc-500">검색하면 후보가 여기에 표시됩니다.</div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {loadError && (
        <div className="my-4 mx-4 md:mx-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loadError}</div>
      )}

      <LoginRequiredModal
        open={loginGuard}
        onClose={() => setLoginGuard(false)}
        onLogin={() => { setLoginGuard(false); navigate('/login'); }}
        onSignup={() => { setLoginGuard(false); navigate('/signup'); }}
      />
      <ThumbnailPicker
        open={thumbOpen}
        images={thumbSix}
        onClose={() => setThumbOpen(false)}
        onShuffle={handleShuffleThumbs}
        onSelect={(url) => onSelectThumbAndSave(url)}
        onSkip={() => onSelectThumbAndSave(null)}
      />
    </div>
  );
}
