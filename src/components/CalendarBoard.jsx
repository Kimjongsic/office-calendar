// src/components/CalendarBoard.jsx
import React, { useState, useRef, useMemo, useLayoutEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings, Plus, CalendarDays, Menu, X, Calendar as CalendarIcon } from 'lucide-react';

export default React.memo(function CalendarBoard({
  year, month, handlePrevMonth, handleToday, handleNextMonth, setIsCategoryManageOpen,
  firstDayIndex, prevDaysInMonth, daysInMonth, filteredEvents, categories, NOTION_PALETTES,
  extractHexColor, selectedDate, setSelectedDate, setNewEvent, setIsAddModalOpen,
  setSelectedEvent, setIsDetailModalOpen, formatDateString, activeSidePanel,
  onEventOrderChange,   // 드래그 중 화면 미리보기 전용 (로컬 state만 갱신)
  onEventOrderCommit,   // 🔑 드래그가 끝났을 때 1회만 Firestore에 저장
  calendarList, currentCalendarId, isCalendarSwitcherOpen, setIsCalendarSwitcherOpen,
  newCalendarName, setNewCalendarName, newCalendarIsPersonal, setNewCalendarIsPersonal,
  handleCreateCalendar, handleDeleteCalendarEntry, handleSwitchCalendar,
  googleAccountEmail, handleSwitchToGoogleCalendar,
  onEventDateMove
}) {
  // 🔑 구글 4색 로고 (연동됐을 때만 탭에 표시)
  const GoogleLogoIcon = () => (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.85A10.99 10.99 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.44.34-2.09V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.85z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.9 1 4.34 3.34 2.18 6.94l3.66 2.85C6.71 7.19 9.14 5.38 12 5.38z"/>
    </svg>
  );

  // 이번 달 마지막 주에 이어지는 다음 달 첫 주의 남은 날짜 계산 공식
  const totalCellsUsedSoFar = firstDayIndex + daysInMonth;
  const nextDaysToRender = totalCellsUsedSoFar % 7 === 0 ? 0 : 7 - (totalCellsUsedSoFar % 7);

  // 다음 달의 연도와 월 계산 (데이터 바인딩용)
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;

  // 지난 달의 연도와 월 계산 (데이터 바인딩용)
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;

  // 드래그 앤 드롭 상태 관리
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [draggedDateStr, setDraggedDateStr] = useState(null);
  const [dragOverEventId, setDragOverEventId] = useState(null);

  // 드래그 도중 마지막으로 계산된 순서를 기억해뒀다가, 드래그 종료 시점에 한 번만 Firestore로 커밋
  const lastOrdersRef = useRef(null);

  // 팝업창이 클릭한 날짜 칸 위로 나오도록 절대 좌표(top, left) 정보 추가
  const [morePopupData, setMorePopupData] = useState({ 
    isOpen: false, dateStr: '', dayName: '', dayNum: null, top: 0, left: 0 
  });
  const morePopupRef = useRef(null);

  // 🔑 팝업이 열린 뒤 실제 렌더링된 크기를 측정해서, 화면 아래/오른쪽으로 넘치면
  // 화면 안쪽으로 위치를 자동 보정 (더보기 목록이 길어져도 항상 전체가 보이도록)
  useLayoutEffect(() => {
    if (!morePopupData.isOpen || !morePopupRef.current) return;

    const margin = 12;
    const rect = morePopupRef.current.getBoundingClientRect();
    let adjustedTop = morePopupData.top;
    let adjustedLeft = morePopupData.left;

    if (rect.bottom > window.innerHeight - margin) {
      adjustedTop = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    if (rect.right > window.innerWidth - margin) {
      adjustedLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (adjustedTop < margin) adjustedTop = margin;
    if (adjustedLeft < margin) adjustedLeft = margin;

    if (adjustedTop !== morePopupData.top || adjustedLeft !== morePopupData.left) {
      setMorePopupData(prev => ({ ...prev, top: adjustedTop, left: adjustedLeft }));
    }
    // 팝업이 새로 열릴 때(dateStr 변경)만 측정 — top/left 보정으로 인한 재실행 루프 방지
  }, [morePopupData.isOpen, morePopupData.dateStr]);

  /**
   * 일정을 추가하면 기존 일정을 침범하지 않고 무조건 최하단에 순차 적재되도록 만드는 핵심 헬퍼 함수
   */
  const sortDayEvents = (dayEventsList, dateStr) => {
    return [...dayEventsList].sort((a, b) => {
      // 🔑 여러 날짜에 걸친 "연속된 일정"을 항상 최상단으로 우선 배치
      const isMultiA = !!(a.startDate && a.endDate && a.startDate !== a.endDate);
      const isMultiB = !!(b.startDate && b.endDate && b.startDate !== b.endDate);
      if (isMultiA !== isMultiB) return isMultiA ? -1 : 1;

      // 🔑 연속된 일정끼리는 드래그 순서와 무관하게 항상 등록(입력)된 순서대로 배치
      if (isMultiA && isMultiB) {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      }

      // 하루짜리 일정끼리는 기존 방식(드래그 순서 우선, 없으면 등록 순서) 그대로 유지
      const orderA = a.dayOrder && a.dayOrder[dateStr] !== undefined ? a.dayOrder[dateStr] : null;
      const orderB = b.dayOrder && b.dayOrder[dateStr] !== undefined ? b.dayOrder[dateStr] : null;

      // 둘 다 명시적인 드래그 순서(dayOrder)가 지정되어 있는 경우 지정된 순서 매핑
      if (orderA !== null && orderB !== null) {
        return orderA - orderB;
      }
      // a만 순서가 있고 b는 신규 일정인 경우 -> b를 무조건 뒤(하단)로 배치
      if (orderA !== null && orderB === null) return -1;
      // b만 순서가 있고 a는 신규 일정인 경우 -> a를 무조건 뒤(하단)로 배치
      if (orderA === null && orderB !== null) return 1;

      // 둘 다 신규 일정이거나 순서 정보가 없는 경우 -> 등록 시간(createdAt) 기준 오름차순 정렬하여 먼저 등록한 게 위, 새것이 밑에 쌓이게 제어
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
  };

  // 🔑 [최적화] filteredEvents가 바뀔 때만 날짜별로 한 번 그룹핑해두고,
  // 각 날짜 칸은 이 맵을 조회만 하도록 변경 (매 렌더마다 전체 배열 반복 필터링 방지)
  const eventsByDate = useMemo(() => {
    const map = new Map();
    filteredEvents.forEach(event => {
      // 🔑 "날짜 옆 배지로 표시" 카테고리는 일반 일정 목록에서 제외 (badgeEventsByDate에서 별도 처리)
      if (categories[event.category]?.showAsBadge) return;

      const start = new Date(event.startDate + 'T00:00:00');
      const end = new Date((event.endDate || event.startDate) + 'T00:00:00');
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

      const cursor = new Date(start);
      while (cursor <= end) {
        const key = formatDateString(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(event);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [filteredEvents, formatDateString, categories]);

  // 🔑 [신규] "날짜 옆 배지로 표시" 카테고리의 일정만 모아 날짜별로 그룹핑
  const badgeEventsByDate = useMemo(() => {
    const map = new Map();
    filteredEvents.forEach(event => {
      if (!categories[event.category]?.showAsBadge) return;

      const start = new Date(event.startDate + 'T00:00:00');
      const end = new Date((event.endDate || event.startDate) + 'T00:00:00');
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

      const cursor = new Date(start);
      while (cursor <= end) {
        const key = formatDateString(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(event);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [filteredEvents, formatDateString, categories]);

  /**
   * 드래그가 시작될 때 이벤트 데이터와 현재 날짜 문자열을 저장합니다.
   */
  const handleDragStart = (e, event, dateStr) => {
    setDraggedEvent(event);
    setDraggedDateStr(dateStr);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.3';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDragOverEventId(null);
    setDraggedEvent(null);
    setDraggedDateStr(null);

    // 🔑 드래그가 끝난 시점에 마지막으로 계산된 순서를 딱 1번만 Firestore에 커밋
    if (lastOrdersRef.current && onEventOrderCommit) {
      onEventOrderCommit(lastOrdersRef.current);
    }
    lastOrdersRef.current = null;
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
  };

  /**
   * 드래그 도중 다른 카드 영역으로 마우스 포인터가 진입하면 실시간으로 순서 교환(Swap) 계산을 트리거합니다.
   * 🔑 여기서는 화면 미리보기(onEventOrderChange)만 갱신하고, Firestore 저장은 하지 않음.
   */
  const handleDragEnter = (e, targetEvent, dateStr) => {
    e.preventDefault();
    if (!draggedEvent || draggedEvent.id === targetEvent.id || draggedDateStr !== dateStr) return;

    setDragOverEventId(targetEvent.id);

    const currentDayEvents = eventsByDate.get(dateStr) || [];
    
    // 정렬 규칙 반영 함수 호출하여 베이스 추출
    const sortedDayEvents = sortDayEvents(currentDayEvents, dateStr);

    const draggedIdx = sortedDayEvents.findIndex(ev => ev.id === draggedEvent.id);
    const targetIdx = sortedDayEvents.findIndex(ev => ev.id === targetEvent.id);

    if (draggedIdx !== -1 && targetIdx !== -1 && draggedIdx !== targetIdx) {
      const updatedDayEvents = [...sortedDayEvents];
      const [removed] = updatedDayEvents.splice(draggedIdx, 1);
      updatedDayEvents.splice(targetIdx, 0, removed);

      const updatedOrders = updatedDayEvents.map((ev, index) => ({
        id: ev.id,
        updatedOrder: {
          ...ev.dayOrder,
          [dateStr]: index
        }
      }));

      lastOrdersRef.current = updatedOrders; // 최종 커밋을 위해 마지막 순서만 기억

      if (onEventOrderChange) {
        onEventOrderChange(updatedOrders); // 화면은 즉시 갱신 (Firestore 쓰기 없음)
      }
    }
  };

  const handleDropOnEvent = (e, dateStr) => {
    e.preventDefault();
    // 🔑 다른 날짜의 카드 위에 놓인 경우 = 그 날짜로 이동
    if (draggedEvent && draggedDateStr && dateStr && draggedDateStr !== dateStr) {
      handleMoveEventToDate(dateStr);
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    setDragOverEventId(null);
  };

  // 🔑 [신규] 하루짜리 일정을 다른 날짜로 드래그하여 이동
  const handleMoveEventToDate = (targetDateStr) => {
    if (!draggedEvent) return;
    if (draggedEvent.startDate !== draggedEvent.endDate) return; // 연속 일정은 드래그 자체가 안 되지만 안전장치
    if (targetDateStr === draggedDateStr) return; // 같은 날짜면 기존 순서변경 로직이 처리
    if (onEventDateMove) onEventDateMove(draggedEvent.id, targetDateStr);
    setDraggedEvent(null);
    setDraggedDateStr(null);
    setDragOverEventId(null);
  };

  /**
   * 더보기 버튼을 클릭했을 때 마우스 위치가 아닌, 
   * 해당 버튼이 위치한 날짜 그리드 칸(Cell)의 물리적 실제 좌표 정보를 역산하여 고정 배치 팝업 위치 연산
   */
  const openMorePopup = (e, dateStr, dayNum, currentDayOfWeek) => {
    e.stopPropagation(); 
    const days = ['일', '월', '화', '수', '목', '금', '토'];

    // 클릭된 요소로부터 가장 가까운 상위 날짜 칸 컨테이너 부모 엘리먼트를 동적으로 탐색합니다.
    const cellElement = e.currentTarget.closest('[data-cell-container="true"]');
    
    let topPos = e.clientY - 120; // 엘리먼트 추적 실패 대비용 기본 예방 폴백
    let leftPos = e.clientX - 128;

    if (cellElement) {
      const rect = cellElement.getBoundingClientRect();
      // 셀의 실제 left, top 좌표에 오프셋 미세 커스텀 보정
      leftPos = rect.left - 4; 
      topPos = rect.top - 4;
    }

    setMorePopupData({
      isOpen: true,
      dateStr,
      dayName: days[currentDayOfWeek],
      dayNum,
      top: topPos,
      left: leftPos
    });
  };

  // 이벤트 카드 렌더러 함수
  const renderEventCard = (event, dateStr) => {
    const theme = categories[event.category] || categories['기타'] || NOTION_PALETTES.gray;
    const isGoogleColored = !!event.colorHex; // 🔑 구글 캘린더에서 가져온 일정은 자체 색상 사용
    const cardBgColor = isGoogleColored ? event.colorHex : (theme.color || '#EAE4F2');
    const textColor = isGoogleColored ? '#FFFFFF' : extractHexColor(theme.text);
    const isHovered = dragOverEventId === event.id;
    const isMultiDay = !!(event.startDate && event.endDate && event.startDate !== event.endDate); // 🔑 연속된 일정은 순서 고정, 드래그 비활성화

    return (
      <div
        key={event.id} data-id={event.id}
        onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); setIsDetailModalOpen(true); }}
        
        draggable={!isMultiDay}
        onDragStart={isMultiDay ? undefined : (e) => handleDragStart(e, event, dateStr)}
        onDragEnd={isMultiDay ? undefined : handleDragEnd}
        onDragOver={isMultiDay ? undefined : handleDragOver}
        onDragEnter={isMultiDay ? undefined : (e) => handleDragEnter(e, event, dateStr)}
        onDrop={isMultiDay ? undefined : (e) => handleDropOnEvent(e, dateStr)}
        
        className={`event-card text-xs leading-normal px-2 py-1 rounded-md border shadow-[0_1px_1px_rgba(0,0,0,0.02)] font-semibold break-keep flex items-center justify-between gap-1 
          transition-all duration-300 transform origin-center 
          ${isHovered ? 'scale-[1.03] -translate-y-0.5 shadow-md z-20' : 'scale-100 translate-y-0'}
          ${isMultiDay ? '' : 'active:cursor-grabbing'}`}
        style={{ 
          backgroundColor: cardBgColor, 
          color: textColor, 
          borderColor: cardBgColor, 
          cursor: isMultiDay ? 'pointer' : 'grab'
        }}
        title={event.title}
      >
        <div className="flex items-start gap-1 min-w-0 flex-1 select-none pointer-events-none">
          {event.startDate !== event.endDate && <CalendarDays className="w-3 h-3 shrink-0 opacity-70 mt-0.5" />}
          <span className="truncate flex-1">{event.title}</span>
        </div>
        {!isMultiDay && (
          <span className="drag-handle text-gray-400 hover:text-gray-800 transition-colors pl-1" onClick={(e) => e.stopPropagation()}>
            <Menu className="w-3 h-3 shrink-0" />
          </span>
        )}
      </div>
    );
  };

  return (
    <section 
      className={`${activeSidePanel ? 'xl:col-span-4' : 'xl:col-span-5'} bg-white border border-[#E9E9E6] rounded-lg p-4 shadow-sm flex flex-col min-h-187.5 min-w-0 transition-all duration-300 relative`}
      style={{ fontFamily: '"Wanted Sans", sans-serif' }}
    >
      
      {/* 캘린더 컨트롤러 헤더 상단바 */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E9E9E6] mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-extrabold text-[#37352F]">{year}년 {month + 1}월</h2>
          <div className="flex items-center bg-[#F7F7F5] border border-[#E9E9E6] rounded-md p-0.5">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-white rounded-sm transition"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={handleToday} className="px-2 py-0.5 text-xs font-semibold hover:bg-white rounded-sm transition mx-1">오늘</button>
            <button onClick={handleNextMonth} className="p-1 hover:bg-white rounded-sm transition"><ChevronRight className="w-4 h-4" /></button>
          </div>

          {/* 🔑 [신규] 캘린더 선택 탭 */}
          <div className="flex items-center gap-1 p-0.5 bg-[#F7F7F5] border border-[#E9E9E6] rounded-lg flex-wrap">
            {calendarList.map((cal) => (
              <div key={cal.id} className="relative group/tab shrink-0">
                <button
                  type="button"
                  onClick={() => handleSwitchCalendar(cal.id)}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-md flex items-center gap-1 whitespace-nowrap transition-colors duration-150 ${cal.id === currentCalendarId ? 'bg-white text-[#37352F] shadow-xs border border-[#E9E9E6]' : 'border border-transparent text-gray-400 hover:text-gray-700'}`}
                >
                  <CalendarIcon className="w-3.5 h-3.5" /> {cal.name} {cal.isPersonal && <span title="개인 캘린더" style={{ fontSize: '10px' }}>🔒</span>}
                </button>
                {calendarList.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteCalendarEntry(cal.id); }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-rose-600 hover:border-rose-300 items-center justify-center hidden group-hover/tab:flex shadow-xs"
                    title="목록에서 제거"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}

            {/* 🔑 개인 전용 구글 캘린더 탭 — 연동됐을 때만 표시 (연동은 설정 모달에서) */}
            {googleAccountEmail && (
              <button
                type="button"
                onClick={handleSwitchToGoogleCalendar}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-md flex items-center gap-1 whitespace-nowrap transition-colors duration-150 shrink-0 ${currentCalendarId === 'google' ? 'bg-white text-blue-700 shadow-xs border border-[#E9E9E6]' : 'border border-transparent text-gray-400 hover:text-gray-700'}`}
                title={googleAccountEmail}
              >
                <GoogleLogoIcon /> 내 구글 캘린더
              </button>
            )}

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsCalendarSwitcherOpen(!isCalendarSwitcherOpen)}
                className="px-2 py-1.5 text-gray-400 hover:text-purple-700 hover:bg-white rounded-md transition"
                title="새 캘린더 추가"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {isCalendarSwitcherOpen && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-[#E9E9E6] rounded-lg shadow-xl z-50 p-2.5 space-y-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="새 캘린더 이름"
                    value={newCalendarName}
                    onChange={(e) => setNewCalendarName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCalendar(); }}
                    className="w-full px-2 py-1.5 border border-[#E9E9E6] rounded text-xs bg-[#F7F7F5] focus:outline-none focus:ring-1 focus:ring-purple-400"
                  />
                  {/* 🔑 [신규] 공유/개인 캘린더 선택 */}
                  <div className="flex gap-1 p-0.5 bg-[#F7F7F5] border border-[#E9E9E6] rounded-md">
                    <button
                      type="button"
                      onClick={() => setNewCalendarIsPersonal(false)}
                      className={`flex-1 py-1.5 rounded text-[11px] font-bold transition-colors ${!newCalendarIsPersonal ? 'bg-white text-purple-700 shadow-xs border border-[#E9E9E6]' : 'text-gray-400'}`}
                    >
                      👥 공유 캘린더
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCalendarIsPersonal(true)}
                      className={`flex-1 py-1.5 rounded text-[11px] font-bold transition-colors ${newCalendarIsPersonal ? 'bg-white text-purple-700 shadow-xs border border-[#E9E9E6]' : 'text-gray-400'}`}
                    >
                      🔒 개인 캘린더
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    {newCalendarIsPersonal ? '이 컴퓨터에만 저장되며 다른 선생님에게는 보이지 않습니다.' : '모든 선생님과 공유되는 캘린더입니다.'}
                  </p>
                  <button type="button" onClick={handleCreateCalendar} className="w-full py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-bold">추가</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => setIsCategoryManageOpen(true)} className="p-2 hover:bg-[#F7F7F5] text-gray-600 rounded-lg border border-[#E9E9E6] transition flex items-center gap-1.5 text-xs font-bold">
          <Settings className="w-4 h-4" /> <span>설정</span>
        </button>
      </div>

      {/* 요일 헤더 인덱스 레일 */}
      <div className="grid grid-cols-[0.8fr_1.2fr_1.2fr_1.2fr_1.2fr_1.2fr_0.8fr] gap-0 text-center font-bold text-xs text-gray-500 border-b border-[#E9E9E6] select-none">
        <div className="py-2 text-rose-500 border-r border-[#E9E9E6] last:border-r-0">일</div>
        <div className="py-2 border-r border-[#E9E9E6] last:border-r-0">월</div>
        <div className="py-2 border-r border-[#E9E9E6] last:border-r-0">화</div>
        <div className="py-2 border-r border-[#E9E9E6] last:border-r-0">수</div>
        <div className="py-2 border-r border-[#E9E9E6] last:border-r-0">목</div>
        <div className="py-2 border-r border-[#E9E9E6] last:border-r-0">금</div>
        <div className="py-2 text-sky-500">토</div>
      </div>

      {/* 노션 스타일 구현 그리드 레일 */}
      <div className="grid grid-cols-[0.8fr_1.2fr_1.2fr_1.2fr_1.2fr_1.2fr_0.8fr] gap-0 flex-1 min-h-125 w-full min-w-0 border-l border-b border-[#E9E9E6]">
        
        {/* 1. 지난 달 이월 일자 렌더링 구역 */}
        {Array.from({ length: firstDayIndex }).map((_, idx) => {
          const prevDayNum = prevDaysInMonth - firstDayIndex + idx + 1;
          const prevDateStr = formatDateString(prevYear, prevMonth, prevDayNum);
          const currentDayOfWeek = idx % 7;
          
          const prevDayEvents = eventsByDate.get(prevDateStr) || [];

          // 일관된 순서 로직 통합 적용
          const sortedEvents = sortDayEvents(prevDayEvents, prevDateStr);
          const isOverLimit = sortedEvents.length > 3;
          const visibleEvents = isOverLimit ? sortedEvents.slice(0, 3) : sortedEvents;

          return (
            <div 
              key={`prev-${idx}`} 
              data-cell-container="true" 
              onClick={() => setSelectedDate(new Date(prevYear, prevMonth, prevDayNum))}
              className="bg-[#F7F7F5]/40 border-r border-b border-[#E9E9E6] p-2 text-gray-300 text-xs text-left select-none overflow-hidden min-w-0 min-h-36 flex flex-col justify-between relative"
            >
              <div className="flex justify-between items-center opacity-40">
                <span className="text-xs font-bold px-1.5 py-0.5">{prevDayNum}</span>
              </div>
              <div className="mt-1 flex-1 overflow-hidden space-y-1">
                {visibleEvents.map(event => {
                  const theme = categories[event.category] || categories['기타'] || NOTION_PALETTES.gray;
                  const baseColor = event.colorHex || theme.color || '#EAE4F2';
                  const textColor = event.colorHex ? '#FFFFFF' : extractHexColor(theme.text);
                  const transparentBg = baseColor.startsWith('#') ? `${baseColor}66` : baseColor;
                  const transparentBorder = `${baseColor}66`;

                  return (
                    <div 
                      key={event.id} 
                      className="text-[10px] truncate px-2 py-0.5 my-0.5 rounded-md border shadow-[0_1px_1px_rgba(0,0,0,0.01)] font-semibold break-keep"
                      style={{ backgroundColor: transparentBg, color: textColor, borderColor: transparentBorder, opacity: 0.6 }}
                    >
                      {event.title}
                    </div>
                  );
                })}
                {isOverLimit && (
                  <button 
                    onClick={(e) => openMorePopup(e, prevDateStr, prevDayNum, currentDayOfWeek)}
                    className="text-[11px] text-gray-500 font-bold block hover:bg-gray-100 rounded px-1 py-0.5 mt-1 transition-colors w-full text-left"
                  >
                    {sortedEvents.length - 3}개 더보기
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* 2. 이번 달 활성 일자 렌더링 구역 */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const dayNum = idx + 1;
          const dateStr = formatDateString(year, month, dayNum);

          const dayEvents = eventsByDate.get(dateStr) || [];
          const badgeEvents = badgeEventsByDate.get(dateStr) || []; // 🔑 이 날짜의 배지 표시 일정

          // 일관된 순서 로직 통합 적용 (추가 시 무조건 기존 리스트 밑으로 오도록 보장)
          const sortedEvents = sortDayEvents(dayEvents, dateStr);
          const isOverLimit = sortedEvents.length > 3;
          const visibleEvents = isOverLimit ? sortedEvents.slice(0, 3) : sortedEvents;

          const isToday = new Date().getDate() === dayNum && new Date().getMonth() === month && new Date().getFullYear() === year;
          const isSelected = selectedDate.getDate() === dayNum && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
          const currentDayOfWeek = new Date(year, month, dayNum).getDay();

          return (
            <div
              key={`day-${dayNum}`}
              data-cell-container="true" 
              onClick={() => setSelectedDate(new Date(year, month, dayNum))}
              onDoubleClick={() => {
                setSelectedDate(new Date(year, month, dayNum));
                setNewEvent(prev => ({ ...prev, startDate: dateStr, endDate: dateStr }));
                setIsAddModalOpen(true);
              }}
              onDragOver={handleDragOver}
              onDrop={(e) => { e.preventDefault(); handleMoveEventToDate(dateStr); }}
              className={`group border-r border-b border-[#E9E9E6] p-2 min-h-36 flex flex-col justify-between transition cursor-pointer relative w-full min-w-0 overflow-hidden ${
                isSelected ? 'bg-slate-50/80' : 'bg-white hover:bg-slate-50/40'
              }`}
            >
              <div className="flex justify-between items-center shrink-0 gap-1">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isToday ? 'bg-amber-400 text-white' : currentDayOfWeek === 0 ? 'text-rose-500' : currentDayOfWeek === 6 ? 'text-sky-500' : 'text-gray-700'}`}>{dayNum}</span>

                <div className="flex items-center gap-1 min-w-0 justify-end">
                  {badgeEvents.map((bEvent) => {
                    const bTheme = categories[bEvent.category] || NOTION_PALETTES.gray;
                    const dotColor = extractHexColor(bTheme.text);
                    return (
                      <button
                        key={bEvent.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedEvent(bEvent); setIsDetailModalOpen(true); }}
                        title={bEvent.title}
                        className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F7F7F5] hover:bg-gray-100 border border-[#E9E9E6] truncate max-w-16 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }}></span>
                        <span className="truncate">{bEvent.title}</span>
                      </button>
                    );
                  })}
                  <button onClick={(e) => { e.stopPropagation(); setNewEvent(prev => ({ ...prev, startDate: dateStr, endDate: dateStr })); setIsAddModalOpen(true); }} className={`p-0.5 hover:bg-gray-200 rounded transition shrink-0 ${badgeEvents.length > 0 ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><Plus className="w-3.5 h-3.5 text-gray-500" /></button>
                </div>
              </div>

              <div data-date={dateStr} className="day-events-container mt-1 flex-1 overflow-y-auto space-y-1 max-h-28 scrollbar-none min-w-0 pb-1">
                {visibleEvents.map(event => renderEventCard(event, dateStr))}
                
                {isOverLimit && (
                  <button 
                    onClick={(e) => openMorePopup(e, dateStr, dayNum, currentDayOfWeek)}
                    className="text-[11px] text-gray-600 font-bold block hover:bg-gray-100 rounded px-1.5 py-0.5 mt-0.5 transition-colors w-full text-left select-none"
                  >
                    {sortedEvents.length - 3}개 더보기
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* 3. 이번 달 마지막 주에 이어지는 다음 달 첫 주의 날짜 렌더링 구역 */}
        {Array.from({ length: nextDaysToRender }).map((_, idx) => {
          const nextDayNum = idx + 1;
          const nextDateStr = formatDateString(nextYear, nextMonth, nextDayNum);
          const currentDayOfWeek = (firstDayIndex + daysInMonth + idx) % 7;

          const nextDayEvents = eventsByDate.get(nextDateStr) || [];

          // 일관된 순서 로직 통합 적용
          const sortedEvents = sortDayEvents(nextDayEvents, nextDateStr);
          const isOverLimit = sortedEvents.length > 3;
          const visibleEvents = isOverLimit ? sortedEvents.slice(0, 3) : sortedEvents;

          return (
            <div
              key={`next-${nextDayNum}`}
              data-cell-container="true" 
              onClick={() => setSelectedDate(new Date(nextYear, nextMonth, nextDayNum))}
              className="bg-[#F7F7F5]/40 border-r border-b border-[#E9E9E6] p-2 text-gray-300 text-xs text-left select-none overflow-hidden min-w-0 min-h-36 flex flex-col justify-between relative"
            >
              <div className="flex justify-between items-center opacity-40">
                <span className="text-xs font-bold px-1.5 py-0.5">{nextDayNum}</span>
              </div>
              <div className="mt-1 flex-1 overflow-hidden space-y-1">
                {visibleEvents.map(event => {
                  const theme = categories[event.category] || categories['기타'] || NOTION_PALETTES.gray;
                  const baseColor = event.colorHex || theme.color || '#EAE4F2';
                  const textColor = event.colorHex ? '#FFFFFF' : extractHexColor(theme.text);
                  const transparentBg = baseColor.startsWith('#') ? `${baseColor}66` : baseColor;
                  const transparentBorder = `${baseColor}66`;

                  return (
                    <div 
                      key={event.id} 
                      className="text-[10px] truncate px-2 py-0.5 my-0.5 rounded-md border shadow-[0_1px_1px_rgba(0,0,0,0.01)] font-semibold break-keep"
                      style={{ backgroundColor: transparentBg, color: textColor, borderColor: transparentBorder, opacity: 0.6 }}
                    >
                      {event.title}
                    </div>
                  );
                })}
                {isOverLimit && (
                  <button 
                    onClick={(e) => openMorePopup(e, nextDateStr, nextDayNum, currentDayOfWeek)}
                    className="text-[11px] text-gray-500 font-bold block hover:bg-gray-100 rounded px-1 py-0.5 mt-1 transition-colors w-full text-left"
                  >
                    {sortedEvents.length - 3}개 더보기
                  </button>
                )}
              </div>
            </div>
          );
        })}

      </div>

      {/* 더보기 동적 추적 팝업 레이어 */}
      {morePopupData.isOpen && (
        <div 
          className="fixed inset-0 bg-transparent z-50 cursor-default"
          onClick={() => setMorePopupData({ isOpen: false, dateStr: '', dayName: '', dayNum: null, top: 0, left: 0 })}
        >
          <div 
            ref={morePopupRef}
            className="fixed bg-white border border-[#E9E9E6] rounded-3xl p-5 w-64 shadow-2xl flex flex-col animate-in zoom-in-95 duration-150 z-50"
            style={{ 
              top: `${morePopupData.top}px`, 
              left: `${morePopupData.left}px`,
              maxHeight: 'calc(100vh - 24px)'
            }}
            onClick={(e) => e.stopPropagation()} 
          >
            {/* 우측 상단 소형 닫기 X 버튼 */}
            <button 
              onClick={() => setMorePopupData({ isOpen: false, dateStr: '', dayName: '', dayNum: null, top: 0, left: 0 })}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            {/* 상단 중앙 요일, 하단 대형 일자 내용 구성 */}
            <div className="text-center select-none mb-4">
              <span className="text-xs font-bold text-gray-400 block">{morePopupData.dayName}</span>
              <span className="text-2xl font-extrabold text-gray-800 block mt-0.5">{morePopupData.dayNum}</span>
            </div>

            {/* 내부 목록 구역 */}
            <div className="flex-1 overflow-y-auto space-y-1 max-h-64 pr-0.5 scrollbar-thin">
              {sortDayEvents(
                eventsByDate.get(morePopupData.dateStr) || [],
                morePopupData.dateStr
              ).map(event => renderEventCard(event, morePopupData.dateStr))}
            </div>
          </div>
        </div>
      )}

    </section>
  );
});