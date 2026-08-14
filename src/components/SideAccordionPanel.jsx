// src/components/SideAccordionPanel.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Utensils, Sparkles, Bookmark, X, Plus, Users, User, Calendar, Download, Upload, Info, ChevronDown, RefreshCw, Clock, MapPin, CalendarIcon, Edit2, Wallet, Trash2, Settings2 } from 'lucide-react';

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
// 엑셀 양식 생성 및 업로드 파싱을 위한 SheetJS 임포트
import * as XLSX from 'xlsx';

const DAYS_SHORT = ['월', '화', '수', '목', '금'];
const PERIODS = ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시'];

// 🔑 [수정] Firestore는 배열 안에 배열(nested array)을 지원하지 않으므로,
// 요일(0~4)을 키로 하는 객체(맵) 안에 7칸짜리 1차원 배열을 넣는 구조로 변경.
// grid[dayIdx][periodIdx] 접근 문법은 배열/객체 동일하게 동작하므로 읽는 쪽 코드는 그대로 둠.
const createEmptyGrid = () => ({
  0: Array(7).fill(''),
  1: Array(7).fill(''),
  2: Array(7).fill(''),
  3: Array(7).fill(''),
  4: Array(7).fill('')
});

export default React.memo(function SideAccordionPanel({
  activeSidePanel, setActiveSidePanel, selectedDate, activeDayMeal,
  messengerInput, setMessengerInput, handleAnalyzeMessengerText, isAnalyzing, parsedProposals,
  setParsedProposals, categories, categoryOrder, NOTION_PALETTES, activeProposalCatDropdownId,
  setActiveProposalCatDropdownId, handleUpdateProposalCategory, handleAddSingleProposalCard, handleEditProposal,
  bookmarks, handleOpenBookmarkUrl, handleDeleteBookmark, newBookmarkTitle,
  setNewBookmarkTitle, newBookmarkUrl, setNewBookmarkUrl, handleAddBookmarkSubmit,
  customTimetables, onUpdateGlobalTimetables, onDeleteGlobalTimetable, myClassNum, myTeacherName
}) {

  // 시간표 제어 전용 상태 그룹
  const [timetableTab, setTimetableTab] = useState('class'); // 'class' 또는 'teacher'
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');

  // 현재 몇 교시인지 실시간 계산하여 보관하는 상태 (0: 해당없음, 1~7교시)
  const [currentPeriod, setCurrentPeriod] = useState(0);
  // 하이라이트를 표시할 '요일 인덱스' 상태 추적 (0: 월 ~ 4: 금)
  const [highlightDayIdx, setHighlightDayIdx] = useState(-1);

  // 현재 편집 중인 셀의 좌표(dayIdx, periodIdx) 추적 상태
  const [editingCell, setEditingCell] = useState(null); 
  const [cellInputValue, setCellInputValue] = useState('');
  const [isManageListOpen, setIsManageListOpen] = useState(false); // 🔑 [신규] 등록된 시간표 관리 목록 펼침 상태

  useEffect(() => {
    const classes = Object.keys(customTimetables.classes || {});
    if (classes.length > 0) {
      // 🔑 저장해둔 담임반(myClassNum)과 이름이 일치하는 반이 있으면 그 반을 우선 선택 (마지막 숫자 기준 비교)
      const myClassMatch = myClassNum
        ? classes.find(c => (c.match(/(\d+)(?!.*\d)/)?.[0]) === String(myClassNum).trim())
        : null;
      setSelectedClass(prev => {
        if (prev && classes.includes(prev)) return prev; // 선택된 반이 삭제되어 없으면 첫 반으로 자동 전환
        return myClassMatch || classes[0];
      });
    } else {
      setSelectedClass('');
    }

    const teachers = Object.keys(customTimetables.teachers || {});
    if (teachers.length > 0) {
      // 🔑 저장해둔 본인 이름(myTeacherName)과 일치하는 교사가 있으면 우선 선택
      const myTeacherMatch = myTeacherName ? teachers.find(t => t === myTeacherName.trim()) : null;
      setSelectedTeacher(prev => {
        if (prev && teachers.includes(prev)) return prev;
        return myTeacherMatch || teachers[0];
      });
    } else {
      setSelectedTeacher('');
    }
  }, [customTimetables, myClassNum, myTeacherName]);

  useEffect(() => {
    if (activeSidePanel !== 'timetable') return;

    const checkCurrentPeriodAndDay = () => {
      const now = new Date();
      const day = now.getDay();
      const minutes = now.getHours() * 60 + now.getMinutes(); 

      if (day === 0 || day === 6) {
        setHighlightDayIdx(-1); 
        setCurrentPeriod(0);   
        return;
      }

      setHighlightDayIdx(day - 1);

      if (minutes >= 510 && minutes <= 560) setCurrentPeriod(1);
      else if (minutes >= 570 && minutes <= 620) setCurrentPeriod(2);
      else if (minutes >= 630 && minutes <= 680) setCurrentPeriod(3);
      else if (minutes >= 690 && minutes <= 740) setCurrentPeriod(4);
      else if (minutes >= 805 && minutes <= 855) setCurrentPeriod(5);
      else if (minutes >= 865 && minutes <= 915) setCurrentPeriod(6);
      else if (minutes >= 925 && minutes <= 975) setCurrentPeriod(7);
      else {
        setCurrentPeriod(0);
      }
    };

    checkCurrentPeriodAndDay();
    const timer = setInterval(checkCurrentPeriodAndDay, 60000); 
    return () => clearInterval(timer);
  }, [activeSidePanel]);

  // 🔑 [신규] 급여 실시간 누적 — 개인 정보라 localStorage(이 PC)에만 저장, 공유 안 함
  const [teacherGrade, setTeacherGrade] = useState(() => localStorage.getItem('teacher_grade') || '');
  const [tempGradeInput, setTempGradeInput] = useState('');
  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    if (teacherGrade) localStorage.setItem('teacher_grade', teacherGrade);
    else localStorage.removeItem('teacher_grade');
  }, [teacherGrade]);

  // 급여 탭이 열려있을 때만 1초마다 갱신 (다른 탭 볼 땐 불필요한 타이머 안 돌림)
  useEffect(() => {
    if (activeSidePanel !== 'salary') return;
    const timer = setInterval(() => setNowTick(new Date()), 1000);
    return () => clearInterval(timer);
  }, [activeSidePanel]);

  const handleSaveGrade = () => {
    const cleaned = tempGradeInput.replace(/[^0-9]/g, '');
    const gradeNum = parseInt(cleaned, 10);
    if (!gradeNum || gradeNum < 1 || gradeNum > 40) return;
    setTeacherGrade(String(gradeNum));
  };

  const handleClearGrade = () => {
    setTeacherGrade('');
    setTempGradeInput('');
  };

  // 🔑 주5일(월~금), 08:30~16:30(8시간) 근무 기준으로 시급/누적액 계산
  // 급여기간: 매달 17일 ~ 다음달 16일. 17일이 지나면 자동으로 새 주기 시작(자연 초기화)
  const salaryStats = useMemo(() => {
    const gradeNum = parseInt(teacherGrade, 10);
    const salaryNum = TEACHER_SALARY_TABLE[gradeNum];
    if (!salaryNum) return null;

    const now = nowTick;
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

    const totalWorkHours = workdayCount * 8;
    const hourlyRate = salaryNum / totalWorkHours;

    let elapsedWorkHours = 0;
    const cursor = new Date(periodStart);
    while (cursor < periodEnd && cursor <= now) {
      const dow = cursor.getDay();
      if (dow >= 1 && dow <= 5) {
        const workStart = new Date(cursor); workStart.setHours(8, 30, 0, 0);
        const workEnd = new Date(cursor); workEnd.setHours(16, 30, 0, 0);
        if (now >= workEnd) {
          elapsedWorkHours += 8;
        } else if (now > workStart) {
          elapsedWorkHours += (now - workStart) / (1000 * 60 * 60);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // 🔑 누적 금액은 30분 정시(=근무 1시간 완료 시점)마다만 갱신되도록 완료된 시간 단위로 계산
    // (게이지는 계속 부드럽게 채워지지만, 숫자는 정시에만 "차르륵" 바뀜)
    const earned = hourlyRate * Math.floor(elapsedWorkHours);

    // 🔑 오늘 게이지용: 08:30~16:30 기준 오늘 하루 진행도 (0~8시간)
    const dow = now.getDay();
    let todayElapsed = 0;
    if (dow >= 1 && dow <= 5) {
      const workStart = new Date(now); workStart.setHours(8, 30, 0, 0);
      const workEnd = new Date(now); workEnd.setHours(16, 30, 0, 0);
      if (now >= workEnd) todayElapsed = 8;
      else if (now > workStart) todayElapsed = (now - workStart) / (1000 * 60 * 60);
    }

    return { hourlyRate, earned, salaryNum, workdayCount, elapsedWorkHours, todayElapsed };
  }, [teacherGrade, nowTick]);

  // 🔑 누적 금액이 바뀔 때마다 이전 값에서 새 값까지 숫자가 빠르게 굴러가며(차르륵) 올라가는 카운트업 애니메이션
  const [displayedEarned, setDisplayedEarned] = useState(0);
  const displayedEarnedRef = useRef(0);
  const rollAnimRef = useRef(null);

  useEffect(() => {
    if (!salaryStats) return;
    const target = Math.floor(salaryStats.earned);
    const start = displayedEarnedRef.current;
    if (target === start) return;

    if (rollAnimRef.current) cancelAnimationFrame(rollAnimRef.current);
    const startTime = performance.now();
    const duration = 650;

    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out
      const value = Math.round(start + (target - start) * eased);
      displayedEarnedRef.current = value;
      setDisplayedEarned(value);
      if (t < 1) rollAnimRef.current = requestAnimationFrame(step);
    };
    rollAnimRef.current = requestAnimationFrame(step);
    return () => { if (rollAnimRef.current) cancelAnimationFrame(rollAnimRef.current); };
  }, [salaryStats?.earned]);

  if (!activeSidePanel) return null;

  /**
   * 특정 셀의 텍스트가 수정 완료되었을 때 상위 App.jsx를 거쳐 파이어베이스 원격 문서로 일괄 업데이트 진행
   * 🔑 [수정] nested array 대신 맵 구조로 불변 업데이트
   */
  const handleCellSave = (dayIdx, periodIdx) => {
    const value = cellInputValue.trim();
    const bucketKey = timetableTab === 'class' ? 'classes' : 'teachers';
    const targetKey = timetableTab === 'class' ? selectedClass : selectedTeacher.trim();
    if (!targetKey) return;

    const existingGrid = (customTimetables[bucketKey] && customTimetables[bucketKey][targetKey]) || createEmptyGrid();
    const existingRow = existingGrid[dayIdx] || Array(7).fill('');
    const updatedRow = [...existingRow];
    updatedRow[periodIdx] = value;
    const updatedGrid = { ...existingGrid, [dayIdx]: updatedRow };

    onUpdateGlobalTimetables(bucketKey, targetKey, updatedGrid); // 🔑 바뀐 반/교사 한 명의 데이터만 전달
    setEditingCell(null);
  };

  /**
   * 엑셀 파일 생성 시 셀 서식을 명시적으로 '텍스트(String)'로 지정하는 엔진
   */
  const downloadExcelTemplate = () => {
    const wb = XLSX.utils.book_new();

    if (timetableTab === 'class') {
      // 🔑 [신규] 전체 반 일괄 업로드용 양식: 1행 요일(병합), 2행 교시, 3행부터 반별 데이터
      const DAY_PERIOD_COUNTS = [
        { day: '월', count: 6 },
        { day: '화', count: 7 },
        { day: '수', count: 6 },
        { day: '목', count: 7 },
        { day: '금', count: 7 },
      ];

      const row1 = ['반'];
      const row2 = [''];
      DAY_PERIOD_COUNTS.forEach(({ day, count }) => {
        for (let p = 1; p <= count; p++) {
          row1.push(p === 1 ? day : ''); // 요일은 각 구간 첫 칸에만 표기 (나머지는 빈칸 → 파싱 시 같은 요일로 인식)
          row2.push(String(p));
        }
      });

      // 🔑 반 번호를 미리 채우지 않고, 빈 행 몇 개만 제공 — 필요한 반만큼 직접 입력하도록
      const EMPTY_ROW_COUNT = 5;
      const dataRows = Array.from({ length: EMPTY_ROW_COUNT }, () => {
        const row = [''];
        for (let c = 1; c < row1.length; c++) row.push('');
        return row;
      });

      const aoa = [row1, row2, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // 요일 헤더 시각적으로 병합
      let colCursor = 1;
      ws['!merges'] = DAY_PERIOD_COUNTS.map(({ count }) => {
        const merge = { s: { r: 0, c: colCursor }, e: { r: 0, c: colCursor + count - 1 } };
        colCursor += count;
        return merge;
      });

      Object.keys(ws).forEach((cellRef) => {
        if (cellRef[0] === '!') return;
        if (ws[cellRef]) ws[cellRef].t = 's';
      });

      XLSX.utils.book_append_sheet(wb, ws, '전체 반 시간표');
      XLSX.writeFile(wb, '전체_반_시간표_양식.xlsx');
    } else {
      // 🔑 [신규] 전체 교사 일괄 업로드용 양식: 1행 요일(병합), 2행 교시, 3행부터 교사별 데이터
      const DAY_PERIOD_COUNTS = [
        { day: '월', count: 6 },
        { day: '화', count: 7 },
        { day: '수', count: 6 },
        { day: '목', count: 7 },
        { day: '금', count: 7 },
      ];

      const row1 = ['교사명'];
      const row2 = [''];
      DAY_PERIOD_COUNTS.forEach(({ day, count }) => {
        for (let p = 1; p <= count; p++) {
          row1.push(p === 1 ? day : '');
          row2.push(String(p));
        }
      });

      const EMPTY_ROW_COUNT = 5;
      const dataRows = Array.from({ length: EMPTY_ROW_COUNT }, () => {
        const row = [''];
        for (let c = 1; c < row1.length; c++) row.push('');
        return row;
      });

      const aoa = [row1, row2, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      let colCursor = 1;
      ws['!merges'] = DAY_PERIOD_COUNTS.map(({ count }) => {
        const merge = { s: { r: 0, c: colCursor }, e: { r: 0, c: colCursor + count - 1 } };
        colCursor += count;
        return merge;
      });

      Object.keys(ws).forEach((cellRef) => {
        if (cellRef[0] === '!') return;
        if (ws[cellRef]) ws[cellRef].t = 's';
      });

      XLSX.utils.book_append_sheet(wb, ws, '전체 교사 시간표');
      XLSX.writeFile(wb, '전체_교사_시간표_양식.xlsx');
    }
  };

  /**
   * 업로드된 엑셀 데이터를 파싱하여 상위 App.jsx를 통해 파이어베이스 클라우드로 동기화 스트리밍
   * 🔑 [수정] parsedGrid를 nested array 대신 맵 구조로 생성
   */
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const parsedTargetName = file.name
      .replace(/\.[^/.]+$/, "") 
      .replace(/_양식|교사별|반별|시간표|양식/g, "") 
      .replace(/[^a-zA-Zㄱ-ㅎ가-힣0-9-]/g, "") 
      .trim();

    const targetKey = parsedTargetName || (timetableTab === 'class' ? '새로운반' : '새로운교사');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary', raw: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // 🔑 [신규] A1 셀이 "반"이면 "전체 반 일괄 업로드" 양식으로 인식하여, 시트 안의 모든 반을 한 번에 등록
        if (timetableTab === 'class' && rows[0] && String(rows[0][0] || '').trim() === '반') {
          const dayHeaderRow = rows[0] || [];
          const periodHeaderRow = rows[1] || [];
          const DAY_NAME_TO_IDX = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4 };

          // 요일 헤더가 병합되어 있으므로, 값이 있는 열부터 다음 요일이 나오기 전까지를 그 요일의 열 범위로 인식
          const dayColumns = [];
          let currentDay = null;
          let currentCols = [];
          for (let col = 1; col < dayHeaderRow.length; col++) {
            const label = String(dayHeaderRow[col] || '').trim();
            if (label && DAY_NAME_TO_IDX[label] !== undefined) {
              if (currentDay) dayColumns.push({ day: currentDay, cols: currentCols });
              currentDay = label;
              currentCols = [col];
            } else if (currentDay) {
              currentCols.push(col);
            }
          }
          if (currentDay) dayColumns.push({ day: currentDay, cols: currentCols });

          // 각 열이 몇 교시에 해당하는지 매핑 (2행의 숫자 기준)
          const colToPeriodIdx = {};
          dayColumns.forEach(({ cols }) => {
            cols.forEach((col, i) => {
              const periodNum = parseInt(periodHeaderRow[col], 10);
              colToPeriodIdx[col] = (periodNum || i + 1) - 1; // 0-based (0~6)
            });
          });

          // 3행부터 각 행(반)마다 시간표 그리드 생성
          const parsedClasses = {};
          for (let r = 2; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            const classNumRaw = String(row[0] || '').trim();
            if (!classNumRaw || !/^\d+$/.test(classNumRaw)) continue; // 🔑 "반" 열이 숫자가 아니면(빈 칸, 텍스트 등) 건너뜀
            const classLabel = `2-${classNumRaw}`; // 🔑 "2-1" 형식으로 등록 (2학년 고정), "시간표" 접미사는 화면 표시할 때만 붙임

            const grid = createEmptyGrid();
            dayColumns.forEach(({ day, cols }) => {
              const dayIdx = DAY_NAME_TO_IDX[day];
              cols.forEach((col) => {
                const periodIdx = colToPeriodIdx[col];
                if (periodIdx === undefined || periodIdx < 0 || periodIdx > 6) return;
                grid[dayIdx][periodIdx] = String(row[col] || '').trim();
              });
            });
            parsedClasses[classLabel] = grid; // 🔑 이미 같은 이름의 반이 있으면 이 값으로 자동 덮어씀
          }

          const classNames = Object.keys(parsedClasses);
          classNames.forEach((className) => {
            onUpdateGlobalTimetables('classes', className, parsedClasses[className]); // 🔑 반마다 개별 필드로 저장 (동시 편집 충돌 방지)
          });

          if (classNames.length > 0) setSelectedClass(classNames[0]);
          e.target.value = '';
          return; // 🔑 일괄 업로드 처리 끝났으니 아래의 기존(단일 반) 파싱 로직은 건너뜀
        }

        // 🔑 [신규] A1 셀이 "교사명"이면 "전체 교사 일괄 업로드" 양식으로 인식하여, 시트 안의 모든 교사를 한 번에 등록
        if (timetableTab === 'teacher' && rows[0] && String(rows[0][0] || '').trim() === '교사명') {
          const dayHeaderRow = rows[0] || [];
          const periodHeaderRow = rows[1] || [];
          const DAY_NAME_TO_IDX = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4 };

          const dayColumns = [];
          let currentDay = null;
          let currentCols = [];
          for (let col = 1; col < dayHeaderRow.length; col++) {
            const label = String(dayHeaderRow[col] || '').trim();
            if (label && DAY_NAME_TO_IDX[label] !== undefined) {
              if (currentDay) dayColumns.push({ day: currentDay, cols: currentCols });
              currentDay = label;
              currentCols = [col];
            } else if (currentDay) {
              currentCols.push(col);
            }
          }
          if (currentDay) dayColumns.push({ day: currentDay, cols: currentCols });

          const colToPeriodIdx = {};
          dayColumns.forEach(({ cols }) => {
            cols.forEach((col, i) => {
              const periodNum = parseInt(periodHeaderRow[col], 10);
              colToPeriodIdx[col] = (periodNum || i + 1) - 1;
            });
          });

          // 🔑 "3. 김길동(16)" 형식에서 순번/단위수를 떼고 순수 이름만 추출
          const extractTeacherName = (raw) => {
            const label = String(raw || '').trim();
            const m = /^\d+\.\s*(.+?)\(\d+\)$/.exec(label);
            return m ? m[1].trim() : label;
          };

          const parsedTeachers = {};
          for (let r = 2; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            const rawLabel = String(row[0] || '').trim();
            if (!rawLabel) continue;
            const teacherName = extractTeacherName(rawLabel);
            if (!teacherName) continue;

            const grid = createEmptyGrid();
            dayColumns.forEach(({ day, cols }) => {
              const dayIdx = DAY_NAME_TO_IDX[day];
              cols.forEach((col) => {
                const periodIdx = colToPeriodIdx[col];
                if (periodIdx === undefined || periodIdx < 0 || periodIdx > 6) return;
                // 🔑 셀 안에 이미 "반\n과목" 형태로 줄바꿈이 들어있으므로 그대로 사용 (기존 렌더링 로직과 호환)
                grid[dayIdx][periodIdx] = String(row[col] || '').trim();
              });
            });
            parsedTeachers[teacherName] = grid;
          }

          const teacherNames = Object.keys(parsedTeachers);
          teacherNames.forEach((name) => {
            onUpdateGlobalTimetables('teachers', name, parsedTeachers[name]); // 🔑 교사마다 개별 필드로 저장 (동시 편집 충돌 방지)
          });

          if (teacherNames.length > 0) setSelectedTeacher(teacherNames[0]);
          e.target.value = '';
          return; // 🔑 일괄 업로드 처리 끝났으니 아래의 기존(단일 교사) 파싱 로직은 건너뜀
        }

        const parsedGrid = createEmptyGrid(); // 🔑 배열의 배열 대신 맵 구조로 생성
        
        if (timetableTab === 'class') {
          for (let pIdx = 0; pIdx < 7; pIdx++) {
            const rowData = rows[pIdx + 1] || [];
            for (let dIdx = 0; dIdx < 5; dIdx++) {
              parsedGrid[dIdx][pIdx] = String(rowData[dIdx + 1] || '').trim();
            }
          }
        } else {
          for (let pIdx = 0; pIdx < 7; pIdx++) {
            const subjectRowData = rows[pIdx * 2 + 1] || [];
            const classRowData = rows[pIdx * 2 + 2] || [];
            
            for (let dIdx = 0; dIdx < 5; dIdx++) {
              const subjectVal = String(subjectRowData[dIdx + 1] || '').trim();
              const classVal = String(classRowData[dIdx + 1] || '').trim();
              
              if (subjectVal && classVal) {
                parsedGrid[dIdx][pIdx] = `${subjectVal}\n${classVal}`;
              } else {
                parsedGrid[dIdx][pIdx] = subjectVal || classVal || '';
              }
            }
          }
        }

        const bucketKey = timetableTab === 'class' ? 'classes' : 'teachers';
        onUpdateGlobalTimetables(bucketKey, targetKey, parsedGrid); // 🔑 업로드된 반/교사 데이터만 전달

        if (timetableTab === 'class') {
          setSelectedClass(targetKey);
        } else {
          setSelectedTeacher(targetKey);
        }

        e.target.value = ''; 
      } catch (err) {
        console.error("엑셀 파일 파싱 오류 발생: ", err);
      }
    };
    reader.readAsBinaryString(file);
  };

  // 🔑 "2-1", "2-10", "2-2" 같은 반 이름을 뒤쪽 숫자 기준으로 자연스럽게 정렬 (2-1, 2-2, ..., 2-10 순)
  const classList = Object.keys(customTimetables.classes || {}).sort((a, b) => {
    const numA = parseInt(a.match(/(\d+)(?!.*\d)/)?.[0] ?? '0', 10);
    const numB = parseInt(b.match(/(\d+)(?!.*\d)/)?.[0] ?? '0', 10);
    return numA - numB;
  });
  const teacherList = Object.keys(customTimetables.teachers || {}).sort((a, b) => a.localeCompare(b, 'ko')); // 🔑 가나다순 정렬
  const hasClasses = classList.length > 0;
  const hasTeachers = teacherList.length > 0;

  return (
    <aside 
      className={`xl:col-span-1 w-full bg-white border border-[#E9E9E6] rounded-xl shadow-sm p-4 relative min-w-0 transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
        activeSidePanel === 'timetable' ? 'xl:min-h-197.5 max-h-220' : 'h-fit'
      }`}
    >
      <button 
        onClick={() => setActiveSidePanel(null)} 
        className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-all z-10"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="text-xs">
        
        {activeSidePanel === 'timetable' && (
          <div className="space-y-4 font-sans flex flex-col flex-1 justify-between">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg"><Calendar className="w-4 h-4" /></div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">시간표 대시보드</h3>
                </div>
              </div>

              {/* 🔑 X 버튼과 동일한 absolute top-3 기준으로 위치를 맞춤 (X 버튼 바로 왼쪽) */}
              <button
                type="button"
                onClick={() => setIsManageListOpen(!isManageListOpen)}
                className={`absolute top-3 right-10 p-1 rounded-md transition-all z-10 ${isManageListOpen ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:text-gray-800 hover:bg-gray-100'}`}
                title="등록된 시간표 관리"
              >
                <Settings2 className="w-4 h-4" />
              </button>

              {/* 🔑 관리 버튼을 누르면 펼쳐지는 등록된 시간표 삭제 목록 — 현재 탭(반별/교사별)에 해당하는 것만 표시 */}
              {isManageListOpen && (
                <div className="bg-[#F7F7F5] border border-[#E9E9E6] rounded-lg p-2.5 space-y-1 max-h-40 overflow-y-auto">
                  {timetableTab === 'class' ? (
                    classList.length > 0 ? (
                      classList.map((cls) => (
                        <div key={cls} className="flex items-center justify-between bg-white border border-[#E9E9E6] rounded-md px-2.5 py-1.5">
                          <span className="text-xs font-semibold text-gray-700 truncate">{cls} 시간표</span>
                          <button
                            type="button"
                            onClick={() => { if (window.confirm(`'${cls} 시간표'를 삭제할까요?`)) onDeleteGlobalTimetable('classes', cls); }}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-gray-400 text-center py-2">등록된 반별 시간표가 없습니다.</p>
                    )
                  ) : (
                    teacherList.length > 0 ? (
                      teacherList.map((teacher) => (
                        <div key={teacher} className="flex items-center justify-between bg-white border border-[#E9E9E6] rounded-md px-2.5 py-1.5">
                          <span className="text-xs font-semibold text-gray-700 truncate">{teacher} 선생님 시간표</span>
                          <button
                            type="button"
                            onClick={() => { if (window.confirm(`'${teacher} 선생님' 시간표를 삭제할까요?`)) onDeleteGlobalTimetable('teachers', teacher); }}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-gray-400 text-center py-2">등록된 교사별 시간표가 없습니다.</p>
                    )
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 p-0.5 bg-[#F7F7F5] border border-[#E9E9E6] rounded-lg shrink-0">
                <button 
                  onClick={() => { setTimetableTab('class'); setEditingCell(null); }} 
                  className={`py-1.5 text-center font-bold rounded-md flex items-center justify-center gap-1 transition-colors duration-150 ${timetableTab === 'class' ? 'bg-white text-[#37352F] shadow-xs border border-[#E9E9E6]' : 'border border-transparent text-gray-400 hover:text-gray-700'}`}
                >
                  <Users className="w-3.5 h-3.5" /> 반별 시간표
                </button>
                <button 
                  onClick={() => { setTimetableTab('teacher'); setEditingCell(null); }} 
                  className={`py-1.5 text-center font-bold rounded-md flex items-center justify-center gap-1 transition-colors duration-150 ${timetableTab === 'teacher' ? 'bg-white text-[#37352F] shadow-xs border border-[#E9E9E6]' : 'border border-transparent text-gray-400 hover:text-gray-700'}`}
                >
                  <User className="w-3.5 h-3.5" /> 교사별 시간표
                </button>
              </div>

              {timetableTab === 'class' ? (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">등록/선택된 학급 리스트</label>
                  {hasClasses ? (
                    <div className="flex flex-wrap gap-1.5">
                      {classList.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setSelectedClass(c); setEditingCell(null); }}
                          className={`w-14 h-9 shrink-0 rounded-md text-xs font-bold transition-colors border truncate px-1 ${
                            selectedClass === c
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-[#F7F7F5] text-gray-600 border-[#E9E9E6] hover:bg-gray-100'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2.5 px-3 border border-dashed border-gray-200 rounded-lg text-gray-400 font-medium bg-[#F7F7F5]/30 text-[11px]">
                      하단에서 반별 시간표 엑셀 파일을 등록해주세요.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">등록/선택된 교사 리스트</label>
                  {hasTeachers ? (
                    <div className="flex flex-wrap gap-1.5">
                      {teacherList.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => { setSelectedTeacher(t); setEditingCell(null); }}
                          className={`w-16 h-9 shrink-0 rounded-md text-xs font-bold transition-colors border truncate px-1 ${
                            selectedTeacher === t
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-[#F7F7F5] text-gray-600 border-[#E9E9E6] hover:bg-gray-100'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2.5 px-3 border border-dashed border-gray-200 rounded-lg text-gray-400 font-medium bg-[#F7F7F5]/30 text-[11px]">
                      하단에서 교사별 시간표 엑셀 파일을 등록해주세요.
                    </div>
                  )}
                </div>
              )}

              <p className="text-[10px] text-gray-400 font-medium leading-tight">
                💡 시간표 등록 완료 후 <span className="text-blue-600 font-bold">셀을 클릭하면 개별 수정</span>도 가능합니다.
              </p>

              <div className="border border-[#E9E9E6] rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="grid grid-cols-6 bg-[#F7F7F5] border-b border-[#E9E9E6] text-center font-bold text-gray-500 py-1.5">
                  <div className="border-r border-gray-200/60 text-[10px] flex items-center justify-center">교시</div>
                  {DAYS_SHORT.map(d => <div key={d} className="text-xs">{d}</div>)}
                </div>

                {PERIODS.map((periodLabel, periodIdx) => {
                  const isCurrentRowPeriod = (periodIdx + 1) === currentPeriod;

                  return (
                    <div 
                      key={periodLabel} 
                      className="grid grid-cols-6 text-center items-center border-b border-gray-100 last:border-none min-h-9.5 transition-all rounded-xs relative"
                    >
                      <div className={`bg-[#F7F7F5]/60 font-bold text-[10px] py-2 border-r border-gray-100 h-full flex flex-col items-center justify-center select-none ${isCurrentRowPeriod && highlightDayIdx !== -1 ? 'text-amber-600 bg-amber-50/40' : 'text-gray-400'}`}>
                        <span>{periodIdx + 1}</span>
                      </div>
                      
                      {DAYS_SHORT.map((_, dayIdx) => {
                        let cellText = '';
                        if (timetableTab === 'class') {
                          cellText = selectedClass ? (customTimetables.classes?.[selectedClass]?.[dayIdx]?.[periodIdx] || '') : '';
                        } else {
                          cellText = selectedTeacher ? (customTimetables.teachers?.[selectedTeacher]?.[dayIdx]?.[periodIdx] || '') : '';
                        }

                        const isEditingThis = editingCell && editingCell.day === dayIdx && editingCell.period === periodIdx;
                        const isHighlightedCell = isCurrentRowPeriod && (dayIdx === highlightDayIdx);

                        let displaySubject = cellText;
                        let displayClassInfo = '';
                        
                        if (timetableTab === 'teacher' && cellText.includes('\n')) {
                          const splitPieces = cellText.split('\n');
                          displaySubject = splitPieces[0] || '';
                          displayClassInfo = splitPieces[1] || '';
                        }

                        return (
                          <div 
                            key={dayIdx} 
                            className="h-full border-r border-gray-50 last:border-none flex items-center justify-center p-0.5 min-w-0"
                          >
                            {isEditingThis ? (
                              <div className="w-full h-full flex items-center relative">
                                <textarea 
                                  autoFocus
                                  value={cellInputValue}
                                  onChange={(e) => setCellInputValue(e.target.value)}
                                  onBlur={() => handleCellSave(dayIdx, periodIdx)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleCellSave(dayIdx, periodIdx);
                                    }
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full h-full p-1 bg-blue-50 border border-blue-300 text-blue-800 text-[10px] font-bold rounded focus:outline-none text-center resize-none leading-tight"
                                />
                              </div>
                            ) : (
                              <div 
                                onClick={() => {
                                  if (timetableTab === 'class' && !selectedClass) return;
                                  if (timetableTab === 'teacher' && !selectedTeacher) return;
                                  setEditingCell({ day: dayIdx, period: periodIdx });
                                  setCellInputValue(cellText);
                                }}
                                className={`w-full h-full flex flex-col items-center justify-center text-[10px] font-bold rounded cursor-pointer transition-colors px-0.5 py-1 min-h-9 text-center leading-tight whitespace-pre-line
                                  ${timetableTab === 'class' ? 'break-keep' : 'break-all'}
                                  ${isHighlightedCell ? 'ring-2 ring-amber-400 ring-inset bg-amber-50/10 z-10 shadow-xs' : ''}
                                  ${cellText ? 'text-blue-700 bg-blue-50/30 hover:bg-blue-50/60 font-black' : 'text-gray-300 hover:bg-slate-50 font-normal'}`}
                              >
                                {cellText ? (
                                  timetableTab === 'teacher' ? (
                                    <div className="flex flex-col w-full truncate">
                                      <span className="block truncate font-black text-blue-800">{(displaySubject || '-').split('_').pop()}</span>
                                      <span className="block truncate text-[9px] font-bold text-gray-400 mt-0.5">{(displayClassInfo || '-').split('_').pop()}</span>
                                    </div>
                                  ) : (
                                    cellText.split('_').join('\n')
                                  )
                                ) : (
                                  (timetableTab === 'class' ? (selectedClass ? '+' : '-') : (selectedTeacher ? '+' : '-'))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 space-y-2 shrink-0">
              <div className="grid grid-cols-2 gap-2 bg-[#F7F7F5]/50 border border-[#E9E9E6] rounded-xl p-2.5">
                <button 
                  onClick={downloadExcelTemplate}
                  className="py-2 px-3 border border-[#E9E9E6] bg-white text-gray-700 hover:bg-gray-50 rounded-lg flex items-center justify-center gap-1.5 font-bold text-[11px] shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" /> 양식 다운로드
                </button>
                
                <label className="py-2 px-3 border border-blue-200 bg-blue-50/20 text-blue-700 hover:bg-blue-50/50 rounded-lg flex items-center justify-center gap-1.5 font-bold text-[11px] shadow-2xs cursor-pointer text-center transition-colors">
                  <Upload className="w-3.5 h-3.5" /> 엑셀 파일 등록
                  <input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={handleExcelUpload} 
                    className="hidden" 
                />
                </label>
              </div>

              <div className="bg-[#F7F7F5] border border-[#E9E9E6] rounded-xl p-3 space-y-1.5 text-gray-600 leading-normal relative">
                <p className="font-extrabold text-gray-800 text-[11px] flex items-center gap-1">
                  <span className="flex items-center gap-1"><Info className="w-3.5 h-3.5 text-blue-500 shrink-0" /> 시간표 등록 방법 안내</span>
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-[10px] font-medium text-gray-500">
                  <li><span className="font-bold text-gray-700">'양식 다운로드'</span>로 템플릿 파일을 다운로드합니다.</li>
                  <li>엑셀 파일명을 <span className="font-bold text-blue-600">등록될 이름(예: 2-3, 홍길동)</span>으로 변경합니다.</li>
                  <li>양식 규격(반별은 과목명 단일행, 교사별은 과목/반 2줄행)에 맞게 기입 후 저장합니다.</li>
                  <li><span className="font-bold text-gray-700">'엑셀 파일 등록'</span> 버튼으로 업로드하면 목록에 동적 추가됩니다!</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {activeSidePanel === 'meal' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg"><Utensils className="w-4 h-4" /></div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">오늘의 급식 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일</h3>
              </div>
            </div>

            {activeDayMeal && (activeDayMeal.lunch || activeDayMeal.dinner) ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                {activeDayMeal.lunch ? (
                  <div className="space-y-1">
                    <div className="text-[11px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 inline-block rounded border border-emerald-100">☀️ 중식 구성</div>
                    <div className="bg-[#F7F7F5] p-2.5 rounded-lg border border-gray-100 text-xs text-gray-700 font-semibold whitespace-pre-wrap leading-relaxed">{activeDayMeal.lunch.diet}</div>
                    <p className="text-[9px] text-right text-gray-400 font-bold">열량: {activeDayMeal.lunch.calories}</p>
                  </div>
                ) : ( <p className="text-[10px] text-gray-400 italic bg-gray-50/60 p-2 rounded text-center border border-dashed">중식 미운영 일자</p> )}

                {activeDayMeal.dinner ? (
                  <div className="space-y-1 pt-1 border-t border-gray-100 border-dashed">
                    <div className="text-[11px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 inline-block rounded border border-amber-100">🌙 석식 구성</div>
                    <div className="bg-[#F7F7F5] p-2.5 rounded-lg border border-gray-100 text-xs text-gray-700 font-semibold whitespace-pre-wrap leading-relaxed">{activeDayMeal.dinner.diet}</div>
                    <p className="text-[9px] text-right text-gray-400 font-bold">열량: {activeDayMeal.dinner.calories}</p>
                  </div>
                ) : ( <p className="text-[10px] text-gray-400 italic bg-gray-50/60 p-2 rounded text-center border border-dashed">석식 미운영 일자</p> )}
              </div>
            ) : ( <p className="text-xs text-gray-400 italic text-center py-5 bg-[#F7F7F5]/40 rounded-lg border border-dashed border-gray-200">지정된 급식 정보가 존재하지 않습니다.</p> )}

            {/* 🔑 선택된 날짜의 요일 4교시 기준으로 교사를 두 그룹으로 분류 (날짜 선택에 따라 함께 갱신) */}
            {(() => {
              const DAY_NAME_TO_IDX = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4 };
              const selectedDayIdx = DAY_NAME_TO_IDX[['일', '월', '화', '수', '목', '금', '토'][selectedDate.getDay()]];

              if (selectedDayIdx === undefined) return null; // 🔑 토/일요일은 시간표 대상 아님

              const teacherEntries = Object.entries(customTimetables.teachers || {});
              if (teacherEntries.length === 0) return null;

              const with4th = [];
              const without4th = [];
              teacherEntries.forEach(([name, grid]) => {
                const cell = grid?.[selectedDayIdx]?.[3]; // 🔑 4교시 = index 3
                if (cell && String(cell).trim()) with4th.push(name);
                else without4th.push(name);
              });
              with4th.sort((a, b) => a.localeCompare(b, 'ko'));
              without4th.sort((a, b) => a.localeCompare(b, 'ko'));

              return (
                <div className="space-y-2 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-sky-50 text-sky-700 rounded-lg"><Users className="w-4 h-4" /></div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">{selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 급식 메이트</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#F7F7F5] border border-gray-100 rounded-lg p-2 space-y-1">
                      <p className="text-xs font-black text-gray-500">4교시 없음 😊 ({without4th.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {without4th.length > 0 ? without4th.map(name => (
                          <span key={name} className="text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded px-1.5 py-0.5">{name}</span>
                        )) : <span className="text-xs text-gray-300 italic">없음</span>}
                      </div>
                    </div>
                    <div className="bg-[#F7F7F5] border border-gray-100 rounded-lg p-2 space-y-1">
                      <p className="text-xs font-black text-gray-500">4교시 있음 😢 ({with4th.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {with4th.length > 0 ? with4th.map(name => (
                          <span key={name} className="text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded px-1.5 py-0.5">{name}</span>
                        )) : <span className="text-xs text-gray-300 italic">없음</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {activeSidePanel === 'ai' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
              <div className="p-1.5 bg-purple-50 text-purple-700 rounded-lg animate-pulse"><Sparkles className="w-4 h-4" /></div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">Gemini AI 분석기</h3>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">메신저 원문 붙여넣기</p>
                {messengerInput && (
                  <button type="button" onClick={() => setMessengerInput('')} className="text-[10px] text-gray-400 hover:text-rose-600 underline">전체 삭제</button>
                )}
              </div>
              <textarea 
                rows={8} 
                placeholder="메신저 본문 전체를 복사하여 붙여넣으세요!" 
                value={messengerInput} 
                onChange={(e) => setMessengerInput(e.target.value)} 
                className="w-full p-2.5 border border-[#E9E9E6] rounded-lg bg-[#F7F7F5]/50 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 placeholder:text-gray-400 leading-relaxed" 
              />
              <button 
                type="button" 
                onClick={handleAnalyzeMessengerText} 
                disabled={isAnalyzing}
                className="w-full py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-purple-400 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isAnalyzing ? ( <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> <span>분석 가동중...</span></> ) : ( <><Sparkles className="w-3.5 h-3.5" /> <span>AI 메신저 분석</span></> )}
              </button>
            </div>
            
            {parsedProposals.length > 0 && (
              <div className="space-y-3.5 mt-2 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-[#E9E9E6] pb-1.5">
                  <p className="text-[10px] font-bold text-purple-700 uppercase">분석 일정 ({parsedProposals.length}건)</p>
                  <button onClick={() => setParsedProposals([])} className="text-[10px] text-gray-400 hover:text-gray-600 underline">비우기</button>
                </div>
                
                <div className="space-y-3 max-h-100 overflow-y-auto pr-1 scrollbar-none">
                  {parsedProposals.map((proposal) => {
                    const theme = categories[proposal.category] || NOTION_PALETTES.gray;
                    const hasSelectedCategory = !!proposal.category;
                    return (
                      <div key={proposal.id} className="bg-white border border-[#E9E9E6] rounded-lg p-3 shadow-xs space-y-2.5 hover:border-purple-300 transition-all relative">
                        <div className="space-y-1.5">
                          <div className="relative inline-block">
                            <button 
                              type="button" 
                              onClick={() => setActiveProposalCatDropdownId(activeProposalCatDropdownId === proposal.id ? null : proposal.id)} 
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border whitespace-nowrap ${hasSelectedCategory ? `${theme.bg} ${theme.text} ${theme.border}` : 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'}`}
                            >
                              <span>{proposal.category || '⚠️ 카테고리 선택'}</span>
                              <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                            </button>
                            
                            {activeProposalCatDropdownId === proposal.id && (
                              <div className="absolute left-0 mt-1 w-36 bg-white border border-[#E9E9E6] rounded-md shadow-xl z-50 max-h-40 overflow-y-auto">
                                {categoryOrder.map((catName) => {
                                  const styling = categories[catName];
                                  if (!styling) return null;
                                  return (
                                    <button key={catName} type="button" onClick={() => handleUpdateProposalCategory(proposal.id, catName)} className="w-full px-2 py-1.5 text-left hover:bg-[#F7F7F5] flex items-center gap-1.5 border-b border-gray-50 last:border-0">
                                      <span className={`w-2 h-2 rounded-full ${styling.bg} border ${styling.border} shrink-0`}></span>
                                      <span className="text-[9px] font-semibold text-gray-700">{catName}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span 
                              className="text-[10px] text-gray-500 font-bold flex items-center gap-1 min-w-0"
                              title={proposal.endDate && proposal.endDate !== proposal.startDate ? `${proposal.startDate} ~ ${proposal.endDate}` : proposal.startDate}
                            >
                              <CalendarIcon className="w-3 h-3 text-gray-400 shrink-0" /> 
                              <span className="truncate">
                                {proposal.endDate && proposal.endDate !== proposal.startDate 
                                  ? `${proposal.startDate} ~ ${proposal.endDate}` 
                                  : proposal.startDate}
                              </span>
                            </span>
                            <button 
                              type="button" 
                              onClick={() => handleEditProposal(proposal)} 
                              className="shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
                              title="수정"
                            >
                              <Edit2 className="w-3 h-3" /> 수정
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-[#37352F] break-all">{proposal.title}</h4>
                          <div className="grid grid-cols-1 gap-0.5 text-[10px] text-gray-500">
                            {proposal.startTime && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5 text-gray-400" /> {proposal.startTime}</span>}
                            {proposal.location && <span className="flex items-center gap-1 text-purple-700 font-medium"><MapPin className="w-2.5 h-2.5 text-purple-400" /> {proposal.location}</span>}
                          </div>
                        </div>
                        
                        <button 
                          type="button" 
                          onClick={() => handleAddSingleProposalCard(proposal.id)} 
                          className={`w-full py-1.5 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 ${hasSelectedCategory ? 'bg-[#37352F] text-white hover:bg-black' : 'bg-gray-100 text-amber-800 border border-amber-200'}`}
                        >
                          <Plus className="w-3 h-3" /> <span>{hasSelectedCategory ? '캘린더에 바로 등록' : '카테고리 지정 필수'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSidePanel === 'bookmark' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
              <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg"><Bookmark className="w-4 h-4" /></div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">자주 사용하는 URL</h3>
              </div>
            </div>
            
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-none">
              {bookmarks.length > 0 ? (
                bookmarks.map(bookmark => {
                  let domain = ''; try { domain = new URL(bookmark.url).hostname; } catch (e) { domain = 'globe'; }
                  return (
                    <div key={bookmark.id} className="group/btn flex items-center justify-between bg-[#F7F7F5] border border-gray-100 rounded-lg p-2 hover:bg-white hover:border-blue-300 hover:shadow-2xs transition-all">
                      <a 
                        href={bookmark.url} 
                        onClick={(e) => handleOpenBookmarkUrl(e, bookmark.url)} 
                        className="text-xs font-bold text-gray-700 hover:text-blue-700 truncate flex-1 flex items-center gap-2 pr-2" 
                        title={bookmark.url}
                      >
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
                          alt="" 
                          onError={(e) => { e.target.style.display = 'none'; }} 
                          className="w-4 h-4 rounded-sm bg-white shrink-0 object-contain shadow-3xs" 
                        />
                        <span className="truncate">{bookmark.title}</span>
                      </a>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteBookmark(bookmark.id)} 
                        className="opacity-0 group-hover/btn:opacity-100 p-1 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-all shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              ) : ( 
                <p className="text-[11px] text-gray-400 italic text-center py-6 bg-gray-50/50 rounded-lg border border-dashed">등록된 사이트 링크가 없습니다.</p> 
              )}
            </div>
            
            <form onSubmit={handleAddBookmarkSubmit} className="pt-2 border-t border-gray-100 border-dashed space-y-2">
              <p className="text-[10px] font-black text-blue-800 bg-blue-50 px-2 py-0.5 inline-block rounded">🔗 링크 등록</p>
              <input type="text" placeholder="사이트 이름" value={newBookmarkTitle} onChange={(e) => setNewBookmarkTitle(e.target.value)} className="w-full py-2 px-2.5 border border-[#E9E9E6] rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <input type="text" placeholder="URL 주소" value={newBookmarkUrl} onChange={(e) => setNewBookmarkUrl(e.target.value)} className="w-full py-2 px-2.5 border border-[#E9E9E6] rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm">북마크 추가</button>
            </form>
          </div>
        )}

        {/* ==================== 5. 시급 누적 패널 ==================== */}
        {activeSidePanel === 'salary' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
              <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg"><Wallet className="w-4 h-4" /></div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">오늘도 적립 중 💰</h3>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">내 호봉</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="예: 15"
                  value={tempGradeInput || teacherGrade}
                  onChange={(e) => setTempGradeInput(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGrade(); }}
                  className="flex-1 p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <button onClick={handleSaveGrade} className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-bold">저장</button>
                {teacherGrade && (
                  <button onClick={handleClearGrade} className="px-3 py-2 border border-gray-200 text-gray-500 rounded-md text-xs font-bold hover:bg-gray-50">삭제</button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 leading-snug">1~40호봉 사이로 입력하세요. 이 값은 이 컴퓨터에만 저장되고 다른 선생님과 공유되지 않습니다.</p>
            </div>

            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
              {salaryStats ? (
                <div className="flex items-center gap-3" style={{ gap: '1.5rem' }}>
                  {/* 🔑 왼쪽: 급여기간 전체 근무일 게이지 (1일 = 1칸) */}
                  <svg width="28" height="120" viewBox="0 0 28 120" className="shrink-0">
                    <rect x="1" y="1" width="26" height="118" rx="6" fill="#FFFFFF" stroke="#FCD34D" strokeWidth="2" />
                    {Array.from({ length: salaryStats.workdayCount }).map((_, idx) => {
                      const segH = 110 / salaryStats.workdayCount;
                      const gap = Math.min(1.2, segH * 0.15);
                      const y = 114 - (idx + 1) * segH + gap / 2;
                      const fillLevel = Math.min(1, Math.max(0, (salaryStats.elapsedWorkHours - idx * 8) / 8));

                      if (fillLevel <= 0) {
                        return <rect key={idx} x="4" y={y} width="20" height={segH - gap} rx="1.2" fill="#FEF3C7" />;
                      }
                      if (fillLevel >= 1) {
                        return <rect key={idx} x="4" y={y} width="20" height={segH - gap} rx="1.2" fill="#F59E0B" />;
                      }
                      const partialH = (segH - gap) * fillLevel;
                      return (
                        <g key={idx}>
                          <rect x="4" y={y} width="20" height={segH - gap} rx="1.2" fill="#FEF3C7" />
                          <rect x="4" y={y + (segH - gap) - partialH} width="20" height={partialH} rx="1.2" fill="#FBBF24" />
                        </g>
                      );
                    })}
                  </svg>

                  {/* 🔑 오른쪽: 오늘 근무시간 게이지 (08:30~16:30, 1시간 = 1칸) */}
                  <svg width="16" height="120" viewBox="0 0 16 120" className="shrink-0">
                    <rect x="1" y="1" width="14" height="118" rx="5" fill="#FFFFFF" stroke="#FCD34D" strokeWidth="2" />
                    {Array.from({ length: 8 }).map((_, idx) => {
                      const segH = 110 / 8;
                      const gap = 1.3;
                      const y = 114 - (idx + 1) * segH + gap / 2;
                      const fillLevel = Math.min(1, Math.max(0, salaryStats.todayElapsed - idx));

                      if (fillLevel <= 0) {
                        return <rect key={idx} x="3" y={y} width="10" height={segH - gap} rx="1.3" fill="#FEF3C7" />;
                      }
                      if (fillLevel >= 1) {
                        return <rect key={idx} x="3" y={y} width="10" height={segH - gap} rx="1.3" fill="#F59E0B" />;
                      }
                      const partialH = (segH - gap) * fillLevel;
                      return (
                        <g key={idx}>
                          <rect x="3" y={y} width="10" height={segH - gap} rx="1.3" fill="#FEF3C7" />
                          <rect x="3" y={y + (segH - gap) - partialH} width="10" height={partialH} rx="1.3" fill="#FBBF24" />
                        </g>
                      );
                    })}
                  </svg>

                  <div className="min-w-0 flex-1 flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">이번 급여기간 누적</p>
                    <p className="text-2xl font-black text-amber-700 tabular-nums truncate">
                      {displayedEarned.toLocaleString()}원
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-4 text-center">호봉을 입력하면 실시간 누적 금액이 표시됩니다.</p>
              )}
            </div>

            <div className="bg-[#F7F7F5] border border-[#E9E9E6] rounded-xl p-3 space-y-1 text-[10px] text-gray-500 leading-relaxed">
              <p className="font-bold text-gray-600 flex items-center gap-1"><Info className="w-3 h-3 text-amber-500 shrink-0" /> 계산 기준</p>
              <p>· 평일(월~금) 08:30~16:30 근무시간에만 누적됩니다.</p>
              <p>· 매달 17일에 급여기간이 자동으로 새로 시작됩니다.</p>
              <p>· 본봉(세전, 수당 제외) 기준의 재미용 참고 수치입니다.</p>
            </div>
          </div>
        )}

      </div>
    </aside>
  );
});