// src/components/SalaryTicker.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Wallet, Settings2, ChevronLeft, Info } from 'lucide-react';

// 🔑 2026년 유치원·초등학교·중학교·고등학교 교원 봉급표 (월지급액, 단위: 원)
// 출처: 인사혁신처 고시. 매년 갱신되니 새 봉급표 발표 시 이 배열만 교체하면 됩니다.
const TEACHER_SALARY_TABLE = {
  1: 2041500,  2: 2103300,  3: 2166000,  4: 2228500,  5: 2291500,
  6: 2354400,  7: 2416600,  8: 2478600,  9: 2495600, 10: 2516700,
  11: 2538300, 12: 2585900, 13: 2657500, 14: 2773700, 15: 2889700,
  16: 3006200, 17: 3121000, 18: 3241500, 19: 3361200, 20: 3481000,
  21: 3600700, 22: 3733600, 23: 3865300, 24: 3997500, 25: 4129400,
  26: 4261900, 27: 4400100, 28: 4538000, 29: 4682100, 30: 4826800,
  31: 4971100, 32: 5115200, 33: 5261600, 34: 5407500, 35: 5553600,
  36: 5699100, 37: 5825700, 38: 5952500, 39: 6079500, 40: 6205700,
};

// 🔑 값이 바뀐 자릿수만 살짝 흐려졌다가 다시 선명해지는 "깜빡" 효과
const FlashDigit = ({ digit }) => {
  const ref = useRef(null);
  const prevRef = useRef(digit);

  useEffect(() => {
    if (prevRef.current === digit) return;
    prevRef.current = digit;
    ref.current?.animate(
      [
        { opacity: 0.25, color: '#FBBF24' },
        { opacity: 1, color: '#B45309' },
      ],
      { duration: 500, easing: 'ease-out' }
    );
  }, [digit]);

  return <span ref={ref} style={{ display: 'inline-block' }}>{digit}</span>;
};

const FlashNumber = ({ value }) => {
  const chars = value.toLocaleString().split('');
  return (
    <span style={{ display: 'inline-flex' }}>
      {chars.map((ch, idx) => {
        const key = chars.length - idx;
        return /[0-9]/.test(ch)
          ? <FlashDigit key={key} digit={Number(ch)} />
          : <span key={key}>{ch}</span>;
      })}
    </span>
  );
};

// 🔑 주5일(월~금), 08:30~16:30(8시간) 근무 기준으로 누적액 계산
// 급여기간: 매달 17일 ~ 다음달 16일. 17일이 지나면 자동으로 새 주기 시작
const calcSalaryStats = (grade, now) => {
  const salaryNum = TEACHER_SALARY_TABLE[parseInt(grade, 10)];
  if (!salaryNum) return null;

  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  let periodStart, periodEnd;
  if (day >= 17) {
    periodStart = new Date(year, month, 17, 0, 0, 0, 0);
    periodEnd = new Date(year, month + 1, 17, 0, 0, 0, 0);
  } else {
    periodStart = new Date(year, month - 1, 17, 0, 0, 0, 0);
    periodEnd = new Date(year, month, 17, 0, 0, 0, 0);
  }

  let workdayCount = 0;
  const dayCursor = new Date(periodStart);
  while (dayCursor < periodEnd) {
    const dow = dayCursor.getDay();
    if (dow >= 1 && dow <= 5) workdayCount += 1;
    dayCursor.setDate(dayCursor.getDate() + 1);
  }
  if (workdayCount === 0) return null;

  const hourlyRate = salaryNum / (workdayCount * 8);

  let elapsedWorkHours = 0;
  const cursor = new Date(periodStart);
  while (cursor < periodEnd && cursor <= now) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) {
      const workStart = new Date(cursor); workStart.setHours(8, 30, 0, 0);
      const workEnd = new Date(cursor); workEnd.setHours(16, 30, 0, 0);
      if (now >= workEnd) elapsedWorkHours += 8;
      else if (now > workStart) elapsedWorkHours += (now - workStart) / (1000 * 60 * 60);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // 오늘 진행 막대용 (0~8시간) + 현재 상태
  // status: 'before'(출근 전) | 'working'(근무 중) | 'done'(퇴근 후) | 'weekend'(주말)
  const dow = now.getDay();
  let todayElapsed = 0;
  let status = 'weekend';
  if (dow >= 1 && dow <= 5) {
    const workStart = new Date(now); workStart.setHours(8, 30, 0, 0);
    const workEnd = new Date(now); workEnd.setHours(16, 30, 0, 0);
    if (now >= workEnd) {
      todayElapsed = 8;
      status = 'done';
    } else if (now > workStart) {
      todayElapsed = (now - workStart) / (1000 * 60 * 60);
      status = 'working';
    } else {
      status = 'before';
    }
  }

  return { earned: hourlyRate * elapsedWorkHours, todayElapsed, status };
};

export default function SalaryTicker() {
  // 🔑 개인 정보라 localStorage(이 PC)에만 저장, 공유 안 함 (기존 사이드 패널과 같은 키라 입력값 그대로 이어짐)
  const [teacherGrade, setTeacherGrade] = useState(() => localStorage.getItem('teacher_grade') || '');
  const [tempGradeInput, setTempGradeInput] = useState('');
  const [isOpen, setIsOpen] = useState(() => localStorage.getItem('salary_ticker_open') === '1');
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    localStorage.setItem('salary_ticker_open', isOpen ? '1' : '0');
  }, [isOpen]);

  useEffect(() => {
    if (teacherGrade) localStorage.setItem('teacher_grade', teacherGrade);
    else localStorage.removeItem('teacher_grade');
  }, [teacherGrade]);

  // 🔑 펼쳐져 있고 호봉이 있을 때만 1초 타이머 가동 (접어두면 타이머 없음)
  useEffect(() => {
    if (!isOpen || !teacherGrade) return;
    setNowTick(new Date());
    const timer = setInterval(() => setNowTick(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isOpen, teacherGrade]);

  const stats = useMemo(() => calcSalaryStats(teacherGrade, nowTick), [teacherGrade, nowTick]);

  // 🔑 매초 작은 증가는 즉시 반영, 펼친 직후·호봉 입력처럼 큰 변화만 카운트업
  const [displayedEarned, setDisplayedEarned] = useState(0);
  const displayedEarnedRef = useRef(0);
  const rollAnimRef = useRef(null);

  useEffect(() => {
    if (!stats) return;
    const target = Math.floor(stats.earned);
    const start = displayedEarnedRef.current;
    if (target === start) return;

    if (rollAnimRef.current) cancelAnimationFrame(rollAnimRef.current);

    if (Math.abs(target - start) < 1000) {
      displayedEarnedRef.current = target;
      setDisplayedEarned(target);
      return;
    }

    const startTime = performance.now();
    const duration = 650;
    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(start + (target - start) * eased);
      displayedEarnedRef.current = value;
      setDisplayedEarned(value);
      if (t < 1) rollAnimRef.current = requestAnimationFrame(step);
    };
    rollAnimRef.current = requestAnimationFrame(step);
    return () => { if (rollAnimRef.current) cancelAnimationFrame(rollAnimRef.current); };
  }, [stats?.earned]);

  const handleSaveGrade = () => {
    const gradeNum = parseInt(tempGradeInput.replace(/[^0-9]/g, ''), 10);
    if (!gradeNum || gradeNum < 1 || gradeNum > 40) return;
    setTeacherGrade(String(gradeNum));
    setTempGradeInput('');
    setIsSettingOpen(false);
  };

  const handleClearGrade = () => {
    setTeacherGrade('');
    setTempGradeInput('');
    displayedEarnedRef.current = 0;
    setDisplayedEarned(0);
  };

  // 🔑 접힌 상태: 지갑 아이콘만
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-1.5 rounded-md text-gray-500 hover:bg-amber-50 hover:text-amber-600 transition-colors cursor-pointer shrink-0"
        style={{ WebkitAppRegion: 'no-drag' }}
        title="오늘도 적립 중 펼치기"
      >
        <Wallet className="w-4 h-4" />
      </button>
    );
  }

  // 🔑 펼친 상태: 누적 금액 배지
  return (
    <div className="relative shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
      <div className="relative flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 pl-3 pr-1 py-1 rounded-full font-medium overflow-hidden">
        <Wallet className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="hidden xl:inline text-amber-700 font-semibold whitespace-nowrap">오늘도 적립 중</span>
        {stats ? (
          <>
            <span className="text-sm font-black text-amber-700 tabular-nums whitespace-nowrap">
              <FlashNumber value={displayedEarned} />원
            </span>
            {/* 🔑 근무시간 밖에는 금액이 멈춰 있는 이유를 알려주는 상태 배지 */}
            {stats.status !== 'working' && (
              <span className="text-[10px] font-semibold text-amber-600 bg-white/70 border border-amber-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                {stats.status === 'before' ? '08:30부터 적립' : stats.status === 'done' ? '오늘 적립 완료' : '주말 휴식'}
              </span>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsSettingOpen(true)}
            className="text-amber-700 font-bold underline underline-offset-2 whitespace-nowrap"
          >
            호봉 설정
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsSettingOpen(!isSettingOpen)}
          className="p-1 rounded-full text-amber-600 hover:bg-amber-100 transition"
          title="호봉 설정"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => { setIsOpen(false); setIsSettingOpen(false); }}
          className="p-1 rounded-full text-amber-600 hover:bg-amber-100 transition"
          title="접기"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* 오늘 근무시간 진행 막대 (08:30~16:30) */}
        {stats && (
          <div
            className="absolute left-0 bottom-0 h-0.5 bg-amber-400 transition-all duration-1000"
            style={{ width: `${(stats.todayElapsed / 8) * 100}%` }}
          />
        )}
      </div>

      {isSettingOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-[#E9E9E6] rounded-lg shadow-xl z-50 p-3 space-y-2">
          <p className="text-sm font-bold text-gray-800">내 호봉</p>
          <div className="flex gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              placeholder="예: 15"
              value={tempGradeInput || teacherGrade}
              onChange={(e) => setTempGradeInput(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGrade(); }}
              className="flex-1 min-w-0 p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <button type="button" onClick={handleSaveGrade} className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-bold">저장</button>
            {teacherGrade && (
              <button type="button" onClick={handleClearGrade} className="px-3 py-2 border border-gray-200 text-gray-500 rounded-md text-xs font-bold hover:bg-gray-50">삭제</button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 leading-snug">1~40호봉 사이로 입력하세요. 이 값은 이 컴퓨터에만 저장되고 다른 선생님과 공유되지 않습니다.</p>
          <div className="bg-[#F7F7F5] border border-[#E9E9E6] rounded-md p-2 space-y-0.5 text-[10px] text-gray-500 leading-relaxed">
            <p className="font-bold text-gray-600 flex items-center gap-1"><Info className="w-3 h-3 text-amber-500 shrink-0" /> 계산 기준</p>
            <p>· 평일(월~금) 08:30~16:30 근무시간에만 누적됩니다.</p>
            <p>· 매달 17일에 급여기간이 자동으로 새로 시작됩니다.</p>
            <p>· 본봉(세전, 수당 제외) 기준의 재미용 참고 수치입니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}