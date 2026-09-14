// src/components/MyClassMini.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, initAnonymousAuth } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, X, Pin, RefreshCw, Minus } from 'lucide-react';

const appId = 'notion-school-calendar';
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const neisConfig = {
  key: import.meta.env.VITE_NEIS_API_KEY,
  officeCode: import.meta.env.VITE_NEIS_OFFICE_CODE,
  schoolCode: import.meta.env.VITE_NEIS_SCHOOL_CODE,
};

/** "3학년 2반", "3-2", "3/2" → "3-2" / 못 읽으면 null */
const normalizeClassKey = (raw) => {
  const t = String(raw || '').replace(/\s+/g, '');
  let m = /(\d+)학년(\d+)반?/.exec(t);
  if (m) return `${Number(m[1])}-${Number(m[2])}`;
  m = /^(\d+)[-–—./](\d+)반?$/.exec(t);
  if (m) return `${Number(m[1])}-${Number(m[2])}`;
  return null;
};

/** 과목명 비교용 정규화 — 괄호/공백 제거, 로마숫자를 아라비아로 통일 */
const ROMAN = { 'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5' };
const normalizeSubject = (raw) =>
  String(raw || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[ⅠⅡⅢⅣⅤ]/g, (c) => ROMAN[c])
    .replace(/\s+/g, '')
    .replace(/I{1,3}$/, (s) => String(s.length));

/** 교사 시간표 셀 파싱 — "과목\n반", "반\n과목" 어느 순서든 허용 */
const parseTeacherCell = (cellText) => {
  const raw = String(cellText || '').trim();
  if (!raw) return null;
  const pieces = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  if (pieces.length === 0) return null;
  if (pieces.length === 1) {
    const onlyClass = normalizeClassKey(pieces[0]);
    return onlyClass
      ? { subject: '', classKey: onlyClass, rawClass: pieces[0] }
      : { subject: pieces[0], classKey: null, rawClass: '' };
  }
  const a = normalizeClassKey(pieces[0]);
  const b = normalizeClassKey(pieces[1]);
  if (b) return { subject: pieces[0], classKey: b, rawClass: pieces[1] };
  if (a) return { subject: pieces[1], classKey: a, rawClass: pieces[0] };
  return { subject: pieces[0], classKey: null, rawClass: pieces[1] };
};

const toYmd = (d) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const toInputValue = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const STATUS_STYLE = {
  ok: { label: '확인', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  changed: { label: '변경?', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  none: { label: '미편성', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  nodata: { label: '대조 불가', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  extra: { label: '추가 편성?', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export default function MyClassMini() {
  const [customTimetables, setCustomTimetables] = useState({ classes: {}, teachers: {} });
  const [myTeacherName, setMyTeacherName] = useState(
    () => (localStorage.getItem('my_teacher_name') || '').trim()
  );
  const [targetDate, setTargetDate] = useState(new Date());
  const [neisState, setNeisState] = useState({ status: 'idle', rows: [] });
  const [isPinned, setIsPinned] = useState(true);

  // 시간표 문서 실시간 구독
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        await initAnonymousAuth();
      } catch (e) {
        console.error('익명 인증 실패:', e);
        return;
      }
      unsub = onSnapshot(
        doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school_global_timetables'),
        (snap) => setCustomTimetables(snap.exists() ? snap.data() : { classes: {}, teachers: {} })
      );
    })();
    return () => unsub();
  }, []);

  // 나이스 개방포털 — 해당 일자 전체 시간표
  const fetchNeisDay = useCallback(async (date) => {
    if (!neisConfig.key || !neisConfig.schoolCode) {
      setNeisState({ status: 'noconfig', rows: [] });
      return;
    }
    setNeisState({ status: 'loading', rows: [] });
    const url =
      `https://open.neis.go.kr/hub/hisTimetable?KEY=${neisConfig.key}&Type=json&pIndex=1&pSize=1000` +
      `&ATPT_OFCDC_SC_CODE=${neisConfig.officeCode}&SD_SCHUL_CODE=${neisConfig.schoolCode}` +
      `&ALL_TI_YMD=${toYmd(date)}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const rows = data?.hisTimetable?.[1]?.row;
      if (!rows) {
        setNeisState({ status: 'empty', rows: [] });
        return;
      }
      setNeisState({
        status: 'ok',
        rows: rows.map((r) => ({
          classKey: `${Number(r.GRADE)}-${Number(r.CLASS_NM)}`,
          period: Number(r.PERIO),
          subject: r.ITRT_CNTNT || '',
        })),
      });
    } catch (e) {
      console.error('나이스 시간표 수신 실패:', e);
      setNeisState({ status: 'error', rows: [] });
    }
  }, []);

  useEffect(() => {
    fetchNeisDay(targetDate);
  }, [targetDate, fetchNeisDay]);

  // 내 고정 시간표 × 그날 실제 편성 → 최종 목록
  const { lessons, extras, isWeekend } = useMemo(() => {
    const dow = targetDate.getDay();
    if (dow === 0 || dow === 6) return { lessons: [], extras: [], isWeekend: true };

    const grid = customTimetables.teachers?.[myTeacherName];
    if (!grid) return { lessons: [], extras: [], isWeekend: false };

    const dayRow = grid[dow - 1] || [];
    const neisOk = neisState.status === 'ok';

    // (반|교시) → 실제 과목
    const neisMap = new Map();
    if (neisOk) {
      neisState.rows.forEach((r) => neisMap.set(`${r.classKey}|${r.period}`, r.subject));
    }

    const mine = [];
    const myPairs = new Set(); // "반|과목" — 추가 편성 탐지용
    for (let pIdx = 0; pIdx < 7; pIdx++) {
      const parsed = parseTeacherCell(dayRow[pIdx]);
      if (!parsed || (!parsed.subject && !parsed.classKey)) continue;

      const period = pIdx + 1;
      let status = 'nodata';
      let actual = '';

      if (neisOk && parsed.classKey) {
        const found = neisMap.get(`${parsed.classKey}|${period}`);
        if (found === undefined) status = 'none';
        else if (normalizeSubject(found) === normalizeSubject(parsed.subject)) status = 'ok';
        else {
          status = 'changed';
          actual = found;
        }
      }

      if (parsed.classKey && parsed.subject) {
        myPairs.add(`${parsed.classKey}|${normalizeSubject(parsed.subject)}`);
      }
      mine.push({ period, ...parsed, status, actual });
    }

    // 내 담당 조합인데 고정 시간표엔 없는 교시 (보강/증배 가능성)
    const minePeriods = new Set(mine.map((l) => `${l.classKey}|${l.period}`));
    const extraList = [];
    if (neisOk) {
      neisState.rows.forEach((r) => {
        const pair = `${r.classKey}|${normalizeSubject(r.subject)}`;
        if (!myPairs.has(pair)) return;
        if (minePeriods.has(`${r.classKey}|${r.period}`)) return;
        extraList.push({ period: r.period, classKey: r.classKey, subject: r.subject, status: 'extra' });
      });
      extraList.sort((a, b) => a.period - b.period);
    }

    return { lessons: mine, extras: extraList, isWeekend: false };
  }, [customTimetables, myTeacherName, targetDate, neisState]);

  const shiftDate = (delta) => {
    const next = new Date(targetDate);
    next.setDate(next.getDate() + delta);
    setTargetDate(next);
  };

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    window.electronAPI?.miniSetAlwaysOnTop(next);
  };

  const neisNotice = {
    loading: '나이스 시간표 확인 중…',
    empty: '이 날짜는 개방포털에 시간표 데이터가 없습니다.',
    error: '개방포털 연결에 실패했습니다.',
    noconfig: '나이스 API 설정(.env)이 비어 있습니다.',
  }[neisState.status];

  return (
    <div className="w-screen h-screen bg-white flex flex-col text-[#37352F] select-none overflow-hidden">
      {/* 드래그 가능한 상단바 */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-[#E9E9E6] bg-[#FBFBFA] shrink-0"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <span className="text-xs font-bold tracking-tight">
          내 수업 {myTeacherName && <span className="text-gray-400 font-medium">· {myTeacherName}</span>}
        </span>
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            type="button" onClick={() => fetchNeisDay(targetDate)}
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="새로고침"
          ><RefreshCw className="w-3.5 h-3.5" /></button>
          <button
            type="button" onClick={togglePin}
            className={`p-1.5 rounded-md ${isPinned ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}
            title="항상 위"
          ><Pin className="w-3.5 h-3.5" /></button>
          <button
            type="button" onClick={() => window.electronAPI?.miniMinimize()}
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100"
          ><Minus className="w-3.5 h-3.5" /></button>
          <button
            type="button" onClick={() => window.electronAPI?.miniClose()}
            className="p-1.5 rounded-md text-gray-400 hover:bg-rose-50 hover:text-rose-600"
          ><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* 날짜 네비게이션 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#E9E9E6] shrink-0">
        <button
          type="button" onClick={() => shiftDate(-1)}
          className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        ><ChevronLeft className="w-4 h-4" /></button>
        <input
          type="date"
          value={toInputValue(targetDate)}
          onChange={(e) => { if (e.target.value) setTargetDate(new Date(`${e.target.value}T00:00:00`)); }}
          className="flex-1 text-xs font-bold text-center bg-transparent focus:outline-none cursor-pointer"
        />
        <span className={`text-xs font-bold ${targetDate.getDay() === 0 ? 'text-rose-500' : targetDate.getDay() === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
          {DAY_LABELS[targetDate.getDay()]}
        </span>
        <button
          type="button" onClick={() => shiftDate(1)}
          className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        ><ChevronRight className="w-4 h-4" /></button>
        <button
          type="button" onClick={() => setTargetDate(new Date())}
          className="px-2 py-1 text-xs font-bold rounded-md border border-[#E9E9E6] text-gray-500 hover:bg-gray-50"
        >오늘</button>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5">
        {!myTeacherName ? (
          <p className="text-xs text-gray-500 leading-relaxed py-6 text-center">
            캘린더 앱 설정에서 <b>본인 이름</b>을 먼저 저장해주세요.
          </p>
        ) : !customTimetables.teachers?.[myTeacherName] ? (
          <p className="text-xs text-gray-500 leading-relaxed py-6 text-center">
            <b>{myTeacherName}</b> 선생님의 교사별 시간표가<br />아직 등록되지 않았습니다.
          </p>
        ) : isWeekend ? (
          <p className="text-xs text-gray-400 py-6 text-center">주말입니다.</p>
        ) : lessons.length === 0 && extras.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">이 날짜에 편성된 수업이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {[...lessons, ...extras].map((l, i) => {
              const s = STATUS_STYLE[l.status];
              return (
                <div
                  key={`${l.period}-${l.classKey}-${i}`}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border ${
                    l.status === 'none' ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-[#E9E9E6] bg-white'
                  }`}
                >
                  <span className="w-7 h-7 shrink-0 rounded-md bg-[#F1F1EF] text-xs font-extrabold flex items-center justify-center">
                    {l.period}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{l.subject || '(과목 미상)'}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {l.classKey ? `${l.classKey.replace('-', '학년 ')}반` : l.rawClass || '반 미상'}
                      {l.status === 'changed' && <span className="text-amber-600"> · 실제: {l.actual}</span>}
                    </p>
                  </div>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-bold ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {neisNotice && (
        <div className="px-3 py-1.5 border-t border-[#E9E9E6] bg-[#FBFBFA] text-[10px] text-gray-400 shrink-0">
          {neisNotice}
        </div>
      )}
    </div>
  );
}