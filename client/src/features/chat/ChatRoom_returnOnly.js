return (
    <div className={containerClass}>
      {/* 헤더 */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-green-50 to-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center text-green-700 font-bold">
            {otherNickname?.charAt(0) || '#'}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-green-700 text-sm sm:text-base truncate">
              {otherNickname}
            </div>
            {subtitle && (
              <div className="flex items-center gap-2">
                <div className="text-[11px] text-gray-500 truncate max-w-[160px] sm:max-w-xs">
                  {subtitle}
                </div>
                {/* 게시글 이동 버튼 */}
                {roomMeta?.post_id && (
                  <button
                    type="button"
                    onClick={() => navigate(`/mate/${roomMeta.post_id}`)}
                    className="hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full border text-gray-600 hover:bg-gray-50"
                  >
                    게시글 보러가기
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 우측: 알림 + 신고 */}
        <div className="flex items-center gap-2">
          {/* 알림 토글 */}
          <button
            type="button"
            onClick={handleToggleNotification}
            className="hidden sm:inline-flex items-center px-2.5 py-1.5 rounded-full border text-[11px] text-gray-600 bg-white hover:bg-gray-50"
          >
            {notificationButtonLabel}
          </button>

          {/* 신고 아이콘 버튼 */}
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-red-200 text-red-500 hover:bg-red-50"
            title="채팅 신고"
          >
            {/* 플래그 아이콘 (SVG) */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h11l-1 5 4 2-1 5H4z" />
              <path d="M4 22V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* 본문: trip 배너 + 메시지 리스트 + 입력창(sticky) */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 여행 메이트 / trip 상태 배너 */}
        <div className="border-b bg-emerald-50/70 px-4 py-2 text-[11px] sm:text-xs flex flex-wrap items-center gap-2">
          {tripLoading ? (
            <span className="text-gray-500">여행 메이트 정보를 불러오는 중...</span>
          ) : tripError ? (
            <span className="text-red-500">{tripError}</span>
          ) : !trip ? (
            <>
              <span className="text-emerald-800">
                아직 이 상대와의 여행이 확정되지 않았어요. 동행 일정과 기간을 먼저 정해보세요.
              </span>
              <button
                type="button"
                onClick={openTripModal}
                className="ml-auto px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700"
              >
                여행 메이트 확정하기
              </button>
            </>
          ) : (
            <>
              {trip.status === 'pending' && (
                <>
                  <span className="text-emerald-900 font-medium">
                    여행 메이트 초대가 진행 중입니다.
                  </span>
                  <span className="text-emerald-900/80">
                    기간: {trip.start_date?.slice(0, 10)} ~ {trip.end_date?.slice(0, 10)}
                  </span>
                  {meId && Number(trip.user_b) === Number(meId) ? (
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAcceptTrip}
                        disabled={tripActionLoading}
                        className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] hover:bg-emerald-700 disabled:opacity-60"
                      >
                        수락하기
                      </button>
                      <button
                        type="button"
                        onClick={handleDeclineTrip}
                        disabled={tripActionLoading}
                        className="px-2.5 py-1 rounded-full border border-emerald-400 text-emerald-700 text-[11px] hover:bg-emerald-50 disabled:opacity-60"
                      >
                        거절하기
                      </button>
                    </div>
                  ) : (
                    <span className="ml-auto text-emerald-700">
                      초대를 보냈어요. 상대의 수락을 기다리는 중입니다.
                    </span>
                  )}
                </>
              )}

              {trip.status === 'ready' && (
                <>
                  <span className="text-emerald-900 font-medium">
                    여행 메이트가 확정되었습니다.
                  </span>
                  <span className="text-emerald-900/80">
                    기간: {trip.start_date?.slice(0, 10)} ~ {trip.end_date?.slice(0, 10)}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {meetPhase === 'idle' && (
                      <>
                        <span className="text-[11px] text-emerald-700 hidden sm:inline">
                          여행기간 동안 동행시작 버튼이 활성화됩니다.
                        </span>
                        {isTodayWithinTrip(trip) ? (
                          <button
                            type="button"
                            onClick={handleStartTogetherClick}
                            disabled={meetActionLoading}
                            className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {meetActionLoading ? '처리 중...' : '오늘 동행 시작하기'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-600">
                            여행 당일에 둘 다 10분 이내로 &quot;동행 시작&quot;을 누르면 동행이 인증됩니다.
                          </span>
                        )}
                      </>
                    )}

                    {meetPhase === 'countdown' && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span>동행 시작 확인 대기 중</span>
                        <span className="font-mono font-semibold text-red-600">
                          {formatCountdown(meetCountdownSec)}
                        </span>
                      </div>
                    )}

                    {meetPhase === 'expired' && (
                      <div className="flex items-center gap-2 text-[11px] text-red-600">
                        <span>카운트다운이 종료되었어요.</span>
                        {canRestartMeet && (
                          <button
                            type="button"
                            onClick={handleStartTogetherClick}
                            disabled={meetActionLoading}
                            className="px-3 py-1 rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-60"
                          >
                            다시 동행 시작하기
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {['met', 'finished'].includes(trip.status) && (
                <>
                  <span className="text-emerald-900 font-medium">
                    동행이 시작된 여행입니다.
                  </span>
                  {trip.met_at && (
                    <span className="text-emerald-900/80">
                      인증 시각: {formatKoreanDate(trip.met_at)}{' '}
                      {new Date(trip.met_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </>
              )}

              {trip && (trip.status === 'met' || trip.status === 'finished') && (
                <div className="mt-2 flex flex-col gap-2">
                  {/* 기존에 있던 "동행이 시작된 여행입니다" 이런 문구/버튼들 그대로 두고, 그 밑에 추가 */}
                  <div className="flex flex-wrap items-center gap-2">
                    {reviewEligible?.canReview && (
                      <button
                        onClick={openReviewModal}
                        className="px-3 py-1.5 text-xs sm:text-sm rounded-full border border-emerald-400 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                      >
                        동행 후기 작성하기
                      </button>
                    )}

                    {!reviewEligible?.canReview &&
                      reviewEligible?.reason === 'ALREADY_REVIEWED' && (
                        <span className="text-xs text-emerald-700">
                          이미 후기를 작성해 주셨어요. 감사합니다!
                        </span>
                      )}
                  </div>
                </div>
              )}
              

              {trip.status === 'cancelled' && (
                <span className="text-emerald-800">
                  이 여행 초대는 취소/거절되었습니다. 필요하다면 다시 여행 메이트를 확정할 수 있습니다.
                </span>
              )}
            </>
          )}
        </div>

        {/* 메시지 리스트 */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50"
        >
          {loading && msgs.length === 0 ? (
            <div className="space-y-2">
              <div className="h-4 w-20 bg-gray-200 animate-pulse rounded" />
              <div className="h-10 w-2/3 bg-gray-200 animate-pulse rounded" />
              <div className="h-10 w-1/2 bg-gray-200 animate-pulse rounded ml-auto" />
            </div>
          ) : msgs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              아직 대화가 없습니다. 첫 메시지를 보내보세요!
            </div>
          ) : (
            msgs.map((m) => {
              const mine = meId && Number(m.sender_id) === Number(meId);
              const ts = m.sent_at || m.created_at;
              const dateLabel = ts ? formatKoreanDate(ts) : '';
              const showDate = dateLabel && dateLabel !== lastDateLabel;
              if (showDate) lastDateLabel = dateLabel;

              const textContent = m.message ?? m.content ?? '';
              const isSelected = selectedMessageIds.includes(m.id);

              return (
                <React.Fragment key={m.id}>
                  {showDate && (
                    <div className="flex justify-center my-2">
                      <div className="px-3 py-1 rounded-full bg-white border text-[11px] text-gray-500">
                        {dateLabel}
                      </div>
                    </div>
                  )}

                  <div
                    className={`flex items-end gap-2 ${
                      mine ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!mine ? (
                      <div className="flex items-center gap-1">
                        {/* 프로필 동그라미 */}
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[11px] text-gray-600">
                          상대
                        </div>
                        {/* 신고 선택 체크박스 (상대 메시지 + 신고창 열렸을 때만) */}
                        {reportOpen && (
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-red-500"
                            checked={isSelected}
                            onChange={() => toggleSelectMessage(m.id)}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="w-7" />
                    )}

                    <div
                      className={`px-3 py-2 rounded-2xl text-sm shadow-sm max-w-[70%] ${
                        mine
                          ? 'bg-green-200'
                          : 'bg-white border border-gray-200'
                      } ${
                        !mine && reportOpen && isSelected
                          ? 'ring-2 ring-red-300'
                          : ''
                      }`}
                    >
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {textContent}
                      </p>
                      <div className="text-[11px] text-gray-400 mt-1 text-right">
                        {ts
                          ? new Date(ts).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* 새 메시지 배너 */}
        {showNewMsgBanner && !isAtBottom && (
          <div className="relative">
            <div className="absolute inset-x-0 -top-3 flex justify-center">
              <button
                onClick={onBannerClick}
                className="px-4 py-2 rounded-xl shadow-md bg-white/70 backdrop-blur text-gray-800 border border-gray-200 flex items-center gap-2"
              >
                <span className="font-medium">
                  새로운 채팅이 왔어요
                  {unreadCount > 1 ? ` (${unreadCount})` : ''}!
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-80"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* 입력창 (sticky) */}
        <div className="border-t p-3 bg-white sticky bottom-0">
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
              placeholder="메시지 입력."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              onClick={send}
              className="rounded-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm shadow"
            >
              전송
            </button>
          </div>
        </div>
      </div>

      {/* 여행 메이트 확정 모달 (A안 날짜 제한 포함) */}
      {tripModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              여행 메이트 확정하기
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              이 채팅방의 상대와 함께할 여행 기간과 제목을 설정합니다.
            </p>

            {/* 게시글 기간 안내 (있을 때만) */}
            {postStartDate && postEndDate && (
              <div className="mb-3 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                게시글에 작성한 여행 기간:{' '}
                <span className="font-medium">
                  {postStartDate} ~ {postEndDate}
                </span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  여행 제목 (선택)
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  value={tripTitle}
                  onChange={(e) => setTripTitle(e.target.value)}
                  placeholder="예: 3월 제주 힐링 여행"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    시작일
                  </label>
                  <input
                    type="date"
                    className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    value={tripStart}
                    onChange={(e) => setTripStart(e.target.value)}
                    min={
                      usePostRangeOnly && postStartDate
                        ? postStartDate
                        : undefined
                    }
                    max={
                      usePostRangeOnly && postEndDate
                        ? postEndDate
                        : undefined
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    종료일
                  </label>
                  <input
                    type="date"
                    className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    value={tripEnd}
                    onChange={(e) => setTripEnd(e.target.value)}
                    min={
                      usePostRangeOnly && postStartDate
                        ? postStartDate
                        : undefined
                    }
                    max={
                      usePostRangeOnly && postEndDate
                        ? postEndDate
                        : undefined
                    }
                  />
                </div>
              </div>
            </div>

            {/* 게시글 기간 외 날짜 선택 토글 */}
            {postStartDate && postEndDate && (
              <div className="mt-3 text-xs text-gray-600 flex items-center gap-2">
                <input
                  id="custom-date-toggle"
                  type="checkbox"
                  checked={!usePostRangeOnly}
                  onChange={() => setUsePostRangeOnly((prev) => !prev)}
                />
                <label
                  htmlFor="custom-date-toggle"
                  className="cursor-pointer"
                >
                  게시글 기간 외 다른 날짜도 선택하기
                </label>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={closeTripModal}
                disabled={tripActionLoading}
                className="px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreateTrip}
                disabled={tripActionLoading}
                className="px-3 py-1.5 rounded-full bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60"
              >
                {tripActionLoading ? '저장 중...' : '확정하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 신고 모달 */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">
                채팅 신고하기
              </h2>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              신고할 상대방 메시지를 선택하고, 신고 사유를 골라 주세요. 악의적인
              허위 신고는 제재 대상이 될 수 있습니다.
            </p>

            {/* 선택된 메시지 개수 */}
            <div className="text-xs text-gray-600 mb-2">
              선택된 메시지:{' '}
              <span className="font-semibold">
                {selectedMessageIds.length}
              </span>
              개
            </div>

            {/* 신고 사유 버튼 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setReportReason(r.key)}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] border ${
                    reportReason === r.key
                      ? 'bg-red-50 border-red-400 text-red-600'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* 상세 내용 */}
            <textarea
              className="w-full border rounded-lg px-2.5 py-2 text-xs mb-3 resize-none focus:outline-none focus:ring-1 focus:ring-red-300"
              rows={3}
              placeholder="신고 내용을 추가로 설명해 주세요. (선택)"
              value={reportDetail}
              onChange={(e) => setReportDetail(e.target.value)}
            />

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                disabled={reportSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitReport}
                className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={
                  reportSubmitting ||
                  !reportReason ||
                  selectedMessageIds.length === 0
                }
              >
                {reportSubmitting ? '신고 중...' : '신고 접수'}
              </button>
            </div>
          </div>
        </div>
      )}
       {/* ===== 후기 작성 모달 ===== */}
      {reviewModalOpen && reviewEligible?.targetUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-5 space-y-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                동행 후기 작성
              </h2>
              <button
                onClick={closeReviewModal}
                className="text-gray-400 hover:text-gray-600"
                disabled={reviewSubmitting}
              >
                ✕
              </button>
            </div>

            {/* 대상 정보 */}
            <div className="flex items-center gap-3 border rounded-xl px-3 py-2 bg-gray-50">
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600 overflow-hidden">
                {reviewEligible.targetUser.avatar_url ? (
                  <img
                    src={reviewEligible.targetUser.avatar_url}
                    alt={reviewEligible.targetUser.nickname || '프로필'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>상대</span>
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {reviewEligible.targetUser.nickname || '상대 사용자'}
                </div>
                {reviewEligible.trip && (
                  <div className="text-[11px] text-gray-500">
                    {reviewEligible.trip.start_date} ~ {reviewEligible.trip.end_date} 동행
                  </div>
                )}
              </div>
            </div>

            {/* 1단계: 전체 평가 */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700">
                1. 이번 동행은 전반적으로 어땠나요?
              </div>
              <div className="flex flex-wrap gap-2">
                {REVIEW_EMOTIONS.map((opt) => {
                  const selected = reviewEmotion === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setReviewEmotion(opt.key)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${
                        selected
                          ? `${opt.className} ring-1 ring-offset-1 ring-emerald-400`
                          : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
                      }`}
                      disabled={reviewSubmitting}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2단계: 원인 태그 */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700 flex items-center justify-between">
                <span>2. 그렇게 느낀 이유를 선택해 주세요 (1~3개)</span>
                <span className="text-[11px] text-gray-400">
                  {reviewSelectedTags.length}/3
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {(reviewEmotion ? REVIEW_TAGS_BY_EMOTION[reviewEmotion] : []).map(
                  (t) => {
                    const active = reviewSelectedTags.includes(t.key);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => toggleReviewTag(t.key)}
                        className={`px-3 py-1.5 rounded-full text-[11px] border transition ${
                          active
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                        disabled={reviewSubmitting}
                      >
                        {t.label}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* 3단계: 한 줄 코멘트 (선택) */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700">
                3. 한 줄로 남기고 싶은 후기가 있다면 써 주세요 (선택)
              </div>
              <textarea
                rows={3}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                placeholder="예) 시간 약속을 잘 지키고, 일정 조율을 잘해주셔서 편안한 여행이었어요."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                disabled={reviewSubmitting}
              />
            </div>

            {/* 에러 메시지 */}
            {reviewError && (
              <div className="text-xs text-red-500">
                {reviewError}
              </div>
            )}

            {/* 버튼들 */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={closeReviewModal}
                className="px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
                disabled={reviewSubmitting}
              >
                취소
              </button>
              <button
                onClick={handleSubmitReview}
                className="px-4 py-1.5 text-xs rounded-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? '저장 중...' : '후기 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A안: 상대가 먼저 동행 시작을 눌렀을 때 뜨는 모달 */}
      {meetInviteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold mb-3">
              동행 시작 알림
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              <b>{meetInviteModal.startedByNickname}</b>님이 동행 시작을 요청했어요.
            </p>
            <p className="text-xs text-gray-600 mb-4">
              10분 안에 동행을 시작하면 여행이 확정됩니다.
              <br />
              현재 남은 시간:{' '}
              <span className="font-mono font-semibold text-red-600">
                {formatCountdown(meetCountdownSec)}
              </span>
            </p>

            <div className="flex justify-end gap-2 text-sm">
              <button
                onClick={onSnoozeMeetFromModal}
                className="px-4 py-2 rounded-lg border bg-gray-50 hover:bg-gray-100"
              >
                나중에
              </button>
              <button
                onClick={onAcceptMeetFromModal}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                지금 동행 시작하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
