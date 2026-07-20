// src/components/CalendarBoard.jsx
import React, { useState, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Settings, Plus, CalendarDays, Menu, X } from 'lucide-react';

export default function CalendarBoard({
  year, month, handlePrevMonth, handleToday, handleNextMonth, setIsCategoryManageOpen,
  firstDayIndex, prevDaysInMonth, daysInMonth, filteredEvents, categories, NOTION_PALETTES,
  extractHexColor, selectedDate, setSelectedDate, setNewEvent, setIsAddModalOpen,
  setSelectedEvent, setIsDetailModalOpen, formatDateString, activeSidePanel,
  onEventOrderChange,   // 드래그 중 화면 미리보기 전용 (로컬 state만 갱신)
  onEventOrderCommit    // 🔑 드래그가 끝났을 때 1회만 Firestore에 저장
}) {

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

  /**
   * 일정을 추가하면 기존 일정을 침범하지 않고 무조건 최하단에 순차 적재되도록 만드는 핵심 헬퍼 함수
   */
  const sortDayEvents = (dayEventsList, dateStr) => {
    return [...dayEventsList].sort((a, b) => {
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
  }, [filteredEvents, formatDateString]);

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

  const handleDropOnEvent = (e) => {
    e.preventDefault();
    e.stopPropagation();
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
    const textColor = extractHexColor(theme.text);
    const isHovered = dragOverEventId === event.id;

    return (
      <div
        key={event.id} data-id={event.id}
        onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); setIsDetailModalOpen(true); }}
        
        draggable="true"
        onDragStart={(e) => handleDragStart(e, event, dateStr)}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragEnter={(e) => handleDragEnter(e, event, dateStr)}
        onDrop={handleDropOnEvent}
        
        className={`event-card text-xs leading-normal px-2 py-1 rounded-md border shadow-[0_1px_1px_rgba(0,0,0,0.02)] font-semibold break-keep flex items-center justify-between gap-1 
          transition-all duration-300 transform origin-center 
          ${isHovered ? 'scale-[1.03] -translate-y-0.5 shadow-md z-20' : 'scale-100 translate-y-0'}
          active:cursor-grabbing`}
        style={{ 
          backgroundColor: theme.color || '#EAE4F2', 
          color: textColor, 
          borderColor: theme.color || '#E3E2E0', 
          cursor: 'grab'
        }}
        title={event.title}
      >
        <div className="flex items-start gap-1 min-w-0 flex-1 select-none pointer-events-none">
          {event.startDate !== event.endDate && <CalendarDays className="w-3 h-3 shrink-0 opacity-70 mt-0.5" />}
          <span className="truncate flex-1">{event.title}</span>
        </div>
        <span className="drag-handle text-gray-400 hover:text-gray-800 transition-colors pl-1" onClick={(e) => e.stopPropagation()}>
          <Menu className="w-3 h-3 shrink-0" />
        </span>
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
                  const baseColor = theme.color || '#EAE4F2';
                  const textColor = extractHexColor(theme.text);
                  const transparentBg = baseColor.startsWith('#') ? `${baseColor}66` : baseColor;
                  const transparentBorder = theme.color ? `${theme.color}66` : '#E3E2E0';

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
              className={`group border-r border-b border-[#E9E9E6] p-2 min-h-36 flex flex-col justify-between transition cursor-pointer relative w-full min-w-0 overflow-hidden ${
                isSelected ? 'bg-slate-50/80' : 'bg-white hover:bg-slate-50/40'
              }`}
            >
              <div className="flex justify-between items-center shrink-0">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-amber-400 text-white' : currentDayOfWeek === 0 ? 'text-rose-500' : currentDayOfWeek === 6 ? 'text-sky-500' : 'text-gray-700'}`}>{dayNum}</span>
                <button onClick={(e) => { e.stopPropagation(); setNewEvent(prev => ({ ...prev, startDate: dateStr, endDate: dateStr })); setIsAddModalOpen(true); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 rounded transition"><Plus className="w-3.5 h-3.5 text-gray-500" /></button>
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
                  const baseColor = theme.color || '#EAE4F2';
                  const textColor = extractHexColor(theme.text);
                  const transparentBg = baseColor.startsWith('#') ? `${baseColor}66` : baseColor;
                  const transparentBorder = theme.color ? `${theme.color}66` : '#E3E2E0';

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
            className="fixed bg-white border border-[#E9E9E6] rounded-3xl p-5 w-64 shadow-2xl flex flex-col animate-in zoom-in-95 duration-150 z-50"
            style={{ 
              top: `${morePopupData.top}px`, 
              left: `${morePopupData.left}px` 
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
}