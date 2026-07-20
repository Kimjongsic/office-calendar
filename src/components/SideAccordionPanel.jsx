// src/components/SideAccordionPanel.jsx
import React, { useState, useEffect } from 'react';
import { Utensils, Sparkles, Bookmark, X, Plus, Users, User, Calendar, Download, Upload, Info, ChevronDown, RefreshCw, Clock, MapPin, CalendarIcon, Edit2 } from 'lucide-react';
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

export default function SideAccordionPanel({
  activeSidePanel, setActiveSidePanel, selectedDate, activeDayMeal,
  messengerInput, setMessengerInput, handleAnalyzeMessengerText, isAnalyzing, parsedProposals,
  setParsedProposals, categories, NOTION_PALETTES, activeProposalCatDropdownId,
  setActiveProposalCatDropdownId, handleUpdateProposalCategory, handleAddSingleProposalCard, handleEditProposal,
  bookmarks, handleOpenBookmarkUrl, handleDeleteBookmark, newBookmarkTitle,
  setNewBookmarkTitle, newBookmarkUrl, setNewBookmarkUrl, handleAddBookmarkSubmit,
  customTimetables, onUpdateGlobalTimetables 
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

  useEffect(() => {
    const classes = Object.keys(customTimetables.classes || {});
    if (classes.length > 0) {
      setSelectedClass(prev => prev || classes[0]);
    }

    const teachers = Object.keys(customTimetables.teachers || {});
    if (teachers.length > 0) {
      setSelectedTeacher(prev => prev || teachers[0]);
    }
  }, [customTimetables]);

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
    const templateData = [];

    if (timetableTab === 'class') {
      PERIODS.forEach((periodLabel) => {
        templateData.push({ '교시/요일': periodLabel, '월': '', '화': '', '수': '', '목': '', '금': '' });
      });
    } else {
      PERIODS.forEach((periodLabel) => {
        templateData.push({ '교시/분류': `${periodLabel} (과목명)`, '월': '', '화': '', '수': '', '목': '', '금': '' });
        templateData.push({ '교시/요일': `${periodLabel} (학년반)`, '월': '', '화': '', '수': '', '목': '', '금': '' });
      });
    }

    const ws = XLSX.utils.json_to_sheet(templateData);

    Object.keys(ws).forEach((cellRef) => {
      if (cellRef[0] === '!') return; 
      if (ws[cellRef]) {
        ws[cellRef].t = 's'; 
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, '시간표 양식');
    
    const fileName = timetableTab === 'class' 
      ? '반별_시간표_양식.xlsx' 
      : '교사별_시간표_양식.xlsx';

    XLSX.writeFile(wb, fileName);
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

  const classList = Object.keys(customTimetables.classes || {});
  const teacherList = Object.keys(customTimetables.teachers || {});
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
                    <select 
                      value={selectedClass} 
                      onChange={(e) => { setSelectedClass(e.target.value); setEditingCell(null); }}
                      className="w-full p-2 border border-[#E9E9E6] bg-[#F7F7F5] rounded-md font-bold text-gray-700 focus:outline-none"
                    >
                      {classList.map(c => (
                        <option key={c} value={c}>{c} 시간표</option>
                      ))}
                    </select>
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
                    <select 
                      value={selectedTeacher} 
                      onChange={(e) => { setSelectedTeacher(e.target.value); setEditingCell(null); }}
                      className="w-full p-2 border border-[#E9E9E6] bg-[#F7F7F5] rounded-md font-bold text-gray-700 focus:outline-none"
                    >
                      {teacherList.map(t => (
                        <option key={t} value={t}>{t} 선생님</option>
                      ))}
                    </select>
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
                                      <span className="block truncate font-black text-blue-800">{displaySubject || '-'}</span>
                                      <span className="block truncate text-[9px] font-bold text-gray-400 mt-0.5">{displayClassInfo || '-'}</span>
                                    </div>
                                  ) : (
                                    cellText
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
                                {Object.entries(categories).map(([catName, styling]) => (
                                  <button key={catName} type="button" onClick={() => handleUpdateProposalCategory(proposal.id, catName)} className="w-full px-2 py-1.5 text-left hover:bg-[#F7F7F5] flex items-center gap-1.5 border-b border-gray-50 last:border-0">
                                    <span className={`w-2 h-2 rounded-full ${styling.bg} border ${styling.border} shrink-0`}></span>
                                    <span className="text-[9px] font-semibold text-gray-700">{catName}</span>
                                  </button>
                                ))}
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

      </div>
    </aside>
  );
}