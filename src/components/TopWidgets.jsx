// src/components/TopWidgets.jsx
import React, { useState, useEffect } from 'react';
import { MessageSquare, Pin, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

export default function TopWidgets({
  todayNotice, activeNoticeIdx, setActiveNoticeIdx, setNoticeFormList, setIsNoticeEditOpen,
  calculatedDdayValue, setDdayForm, setIsDdayEditOpen, currentTimeStr, currentDateStr
}) {
  
  // 16:30 퇴근 타이머를 위한 실시간 상태 및 계산 함수
  const [timeLeftStr, setTimeLeftStr] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(16, 30, 0, 0); // 퇴근 타겟 스케줄 16:30:00 고정

      const diff = target - now;

      if (diff <= 0) {
        setTimeLeftStr('🎉 칼퇴 완료!');
      } else {
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        
        // "O시간 O분" 형식으로 문자열 유지
        setTimeLeftStr(`${hours}시간 ${minutes}분`);
      }
    };

    calculateTime();
    const intervalId = setInterval(calculateTime, 1000); // 1초 주기로 연산 업데이트 반복
    return () => clearInterval(intervalId);
  }, [currentTimeStr]);

  // 시계에서 초단위를 떼고 분까지만 표시하는 헬퍼 함수
  const formatTimeToMinute = (timeStr) => {
    if (!timeStr) return '--:--';
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return timeStr;
  };

  return (
    // 🌟 [수정 섹션] 요구사항 반영: 폰트를 "Wanted Sans"로 명시적 강제 적용
    <div 
      className="grid grid-cols-1 gap-1.5 items-stretch w-full xl:grid-cols-5"
      style={{ fontFamily: '"Wanted Sans", sans-serif' }}
    >
      {/* 오늘의 한마디 패널 (3/5) */}
      <div className="xl:col-span-3 bg-white border border-[#EAE4F2] shadow-xs rounded-xl px-4 py-3 flex items-center justify-between min-w-0">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <span className="text-xs font-bold text-[#461146] flex items-center gap-1.5 shrink-0 bg-[#EAE4F2] px-2.5 py-1 rounded-full">
            <MessageSquare className="w-3.5 h-3.5" /> 오늘의 한마디
          </span>
          <div className="text-[#37352F] text-sm md:text-base font-semibold truncate border-l border-gray-200 pl-3 flex-1 flex items-baseline gap-2">
            <span className="truncate font-black">
              {todayNotice.words && todayNotice.words[activeNoticeIdx] && todayNotice.words[activeNoticeIdx].text ? todayNotice.words[activeNoticeIdx].text : '등록된 한마디가 없습니다.'}
            </span>
            {todayNotice.words && todayNotice.words[activeNoticeIdx] && todayNotice.words[activeNoticeIdx].author && (
              <span className="text-xs font-medium shrink-0 text-[#37352F]">
                - {todayNotice.words[activeNoticeIdx].author}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-2">
          {todayNotice.words && todayNotice.words.filter(w => w.text).length > 1 && (
            <div className="flex items-center gap-1 bg-white border border-gray-100 rounded px-1.5 py-0.5 text-[10px] text-gray-500 font-bold">
              <button onClick={() => setActiveNoticeIdx(prev => (prev - 1 + todayNotice.words.length) % todayNotice.words.length)} className="hover:text-purple-700"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <span className="tabular-nums">{activeNoticeIdx + 1}/{todayNotice.words.length}</span>
              <button onClick={() => setActiveNoticeIdx(prev => (prev + 1) % todayNotice.words.length)} className="hover:text-purple-700"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <button onClick={() => { setNoticeFormList(todayNotice.words && todayNotice.words.length > 0 ? todayNotice.words : [{ text: '', author: '' }]); setIsNoticeEditOpen(true); }} className="text-xs font-bold text-purple-700 hover:bg-purple-50 px-3 py-1.5 rounded border border-purple-100 transition-colors">+ 등록</button>
        </div>
      </div>

      {/* 디데이 대시보드 (1/5) */}
      <div className="xl:col-span-1 bg-white border border-rose-200 shadow-xs rounded-xl px-4 py-3 flex items-center justify-between min-w-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="p-2 bg-rose-50 rounded-lg text-rose-600 shrink-0"><Pin className="w-3.5 h-3.5" /></span>
          <div className="text-left overflow-hidden">
            {todayNotice.ddayTarget ? (
              <p className="text-sm text-gray-700 truncate flex items-baseline gap-1.5">
                <span className="font-black text-rose-600 text-base shrink-0">D{calculatedDdayValue}</span>
                <span className="font-bold truncate">{todayNotice.ddayLabel}</span>
                {/* 🌟 [수정 섹션] 요구사항 반영: 디데이 이벤트 날짜의 가독성 향상 */}
                {/* 주변 노션 테마 무드를 해치지 않도록 차분한 Slate톤과 적절한 세미볼드 두께(font-semibold)를 적용하고 가독 크기를 확보했습니다. */}
                <span className="text-[11px] text-slate-500 font-semibold shrink-0 bg-slate-100 px-1 py-0.5 rounded">
                  {todayNotice.ddayTarget}
                </span>
              </p>
            ) : (
              <p className="text-xs font-bold text-gray-400">설정 없음</p>
            )}
          </div>
        </div>
        <button onClick={() => { setDdayForm({ label: todayNotice.ddayLabel || '', date: todayNotice.ddayTarget || new Date().toISOString().split('T')[0] }); setIsDdayEditOpen(true); }} className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-2 transition-colors">+ 등록</button>
      </div>

      {/* 시계 대시보드 위젯 (1/5) */}
      <div className="xl:col-span-1 bg-white border border-blue-200 shadow-xs rounded-xl px-4 py-3 flex items-center justify-between min-w-0">
        <div className="flex items-center gap-3 overflow-hidden flex-1 w-full">
          <span className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </span>
          <div className="text-left flex flex-col justify-center flex-1 min-w-0">
            {/* 🌟 [수정 섹션] 요구사항 반영: 시계와 퇴근 타이머의 레이아웃 간격 일관성 매칭 */}
            {/* 좌측(시간, 날짜)과 우측(퇴근라벨, 남은시간)이 완벽한 상하 대칭 및 정렬을 이루도록 flex 격자 구조를 세밀하게 조율하고 mt-1 마진 규격으로 통일했습니다. */}
            <div className="flex items-start justify-between w-full">
              {/* 좌측 영역: 현재 시간 및 날짜 */}
              <div className="flex flex-col items-start shrink-0 min-w-0">
                <p className="text-base font-black text-gray-800 tracking-normal tabular-nums leading-none">
                  {formatTimeToMinute(currentTimeStr)}
                </p>
                <p className="text-[10px] font-medium text-gray-400 tracking-tight leading-none mt-1.5">
                  {currentDateStr || '----년 --월 --일'}
                </p>
              </div>
              
              {/* 우측 영역: 퇴근 라벨 및 남은 시간 카운트 */}
              <div className="flex flex-col items-end shrink-0 text-right min-w-0">
                <span className="text-[10px] font-medium text-gray-400 block leading-none">
                  퇴근까지 남은 시간
                </span>
                <span className="text-[11px] font-black text-amber-600 dark:text-amber-500 tracking-tight mt-1.5 block leading-none">
                  {timeLeftStr}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}