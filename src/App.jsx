// src/App.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db, initAnonymousAuth } from './firebase';
// 드래그 앤 드롭 순서 변경의 원자적 일괄 처리를 위해 writeBatch 라이브러리 추가 바인딩
import { collection, doc, setDoc, deleteDoc, deleteField, onSnapshot, writeBatch } from 'firebase/firestore';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Edit3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  User,
  X,
  MessageSquare,
  Pin,
  Settings,
  Palette,
  Sparkles,
  RefreshCw,
  Clock,
  MapPin,
  FileText,
  Link,
  Users,
  ChevronDown,
  Key,
  Globe,
  Menu,
  Minus,
  Square,
  Lock,
  Unlock,
  Eye,
  Utensils,
  Bookmark,
  Wallet,
  BarChart3,
  Link2,
  Edit2,
  Calculator
} from 'lucide-react';

import DashboardHeader from './components/DashboardHeader';
import TopWidgets from './components/TopWidgets';
import CalendarBoard from './components/CalendarBoard';
import SideAccordionPanel from './components/SideAccordionPanel';
import StudentGradesDashboard from './components/StudentGradesDashboard';

const NOTION_PALETTES = {
  red: { bg: 'bg-[#FFE2DD]', text: 'text-[#5D0F00]', border: 'border-[#FFE2DD]', color: '#FFE2DD', label: '연한 빨강' },
  blue: { bg: 'bg-[#DDEBF1]', text: 'text-[#0C3446]', border: 'border-[#DDEBF1]', color: '#DDEBF1', label: '연한 파랑' },
  yellow: { bg: 'bg-[#FDECC8]', text: 'text-[#5C3B00]', border: 'border-[#FDECC8]', color: '#FDECC8', label: '연한 노랑' },
  green: { bg: 'bg-[#DDEDEA]', text: 'text-[#1C3D27]', border: 'border-[#DDEDEA]', color: '#DDEDEA', label: '연한 녹색' },
  purple: { bg: 'bg-[#EAE4F2]', text: 'text-[#461146]', border: 'border-[#EAE4F2]', color: '#EAE4F2', label: '연한 보라' },
  orange: { bg: 'bg-[#FAE3D9]', text: 'text-[#632000]', border: 'border-[#FAE3D9]', color: '#FAE3D9', label: '연한 주황' },
  gray: { bg: 'bg-[#E3E2E0]', text: 'text-[#37352F]', border: 'border-[#E3E2E0]', color: '#E3E2E0', label: '연한 회색' }
};

const extractHexColor = (className) => {
  const match = className.match(/#([A-Fa-f0-9]{6})/);
  return match ? match[0] : '#37352F';
};

// 🔑 구글 캘린더 이벤트의 colorId → 실제 색상 (구글 공식 팔레트 고정값)
const GOOGLE_EVENT_COLOR_MAP = {
  '1': '#7986CB', '2': '#33B679', '3': '#8E24AA', '4': '#E67C73', '5': '#F6BF26',
  '6': '#F4511E', '7': '#039BE5', '8': '#616161', '9': '#3F51B5', '10': '#0B8043', '11': '#D50000'
};
const GOOGLE_DEFAULT_EVENT_COLOR = '#4285F4';

// 🔑 구글 캘린더 색상 선택 드롭다운에 쓰는 이름 목록 (구글 UI와 동일한 순서/명칭)
const GOOGLE_COLOR_OPTIONS = [
  { id: '', label: '기본값', hex: GOOGLE_DEFAULT_EVENT_COLOR },
  { id: '1', label: '라벤더', hex: '#7986CB' },
  { id: '2', label: '세이지', hex: '#33B679' },
  { id: '3', label: '포도', hex: '#8E24AA' },
  { id: '4', label: '플라밍고', hex: '#E67C73' },
  { id: '5', label: '바나나', hex: '#F6BF26' },
  { id: '6', label: '귤', hex: '#F4511E' },
  { id: '7', label: '공작새', hex: '#039BE5' },
  { id: '8', label: '그래파이트', hex: '#616161' },
  { id: '9', label: '블루베리', hex: '#3F51B5' },
  { id: '10', label: '바질', hex: '#0B8043' },
  { id: '11', label: '토마토', hex: '#D50000' },
];

export default function App() {
  const appId = 'notion-school-calendar';

  // 🔑 [신규] 캘린더 ID에 따라 이벤트가 저장될 Firestore 컬렉션을 반환
  // 'default'(기존 캘린더)는 기존 경로를 그대로 사용해 데이터 이전이 필요 없도록 함
  const getEventsCollectionRef = (calendarId) => {
    if (!calendarId || calendarId === 'default') {
      return collection(db, 'artifacts', appId, 'public', 'data', 'events');
    }
    return collection(db, 'artifacts', appId, 'public', 'data', 'calendars', calendarId, 'events');
  };

  // 🔑 구글 캘린더 이벤트 → 이 앱 내부 형식으로 변환
  const mapGoogleEventToInternal = (gEvent) => {
    const startDate = gEvent.start?.date || (gEvent.start?.dateTime ? gEvent.start.dateTime.slice(0, 10) : '');
    const endDateRaw = gEvent.end?.date || (gEvent.end?.dateTime ? gEvent.end.dateTime.slice(0, 10) : startDate);
    // 구글은 여러 날짜에 걸친 종일 일정의 종료일을 "다음날"로 주므로 하루 빼서 보정.
    // 단, 당일 하루짜리 일정은 start.date와 end.date가 이미 같은 날짜로 오므로 보정하면 안 됨
    // (🔑 이전 버그: 당일 일정까지 하루를 빼서 endDate가 startDate보다 빨라져 화면에서 사라졌음)
    let endDate = endDateRaw;
    if (gEvent.end?.date && endDateRaw !== startDate) {
      const [y, m, d] = endDateRaw.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      dateObj.setDate(dateObj.getDate() - 1);
      endDate = formatDateString(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    }
    return {
      id: gEvent.id,
      title: gEvent.summary || '(제목 없음)',
      category: '구글 일정',
      manager: '',
      startDate,
      endDate: endDate || startDate,
      startTime: gEvent.start?.dateTime ? gEvent.start.dateTime.slice(11, 16) : '',
      endTime: gEvent.end?.dateTime ? gEvent.end.dateTime.slice(11, 16) : '',
      location: gEvent.location || '',
      applyMethod: '',
      applyCount: '',
      memo: gEvent.description || '',
      dayOrder: {},
      createdAt: gEvent.created || new Date().toISOString(),
      colorHex: GOOGLE_EVENT_COLOR_MAP[gEvent.colorId] || GOOGLE_DEFAULT_EVENT_COLOR, // 🔑 구글에서 지정한 일정 색상
      colorId: gEvent.colorId || '', // 🔑 수정 폼에 그대로 반영하기 위해 원본 colorId도 보관
    };
  };

  // 🔑 이 앱 내부 형식 → 구글 캘린더 이벤트 형식으로 변환
  const mapInternalToGoogleEvent = (form) => {
    const payload = { summary: form.title, description: form.memo || '', location: form.location || '' };
    if (form.colorId) payload.colorId = form.colorId; // 🔑 색상 지정 (빈 값이면 구글 기본색 유지)
    if (form.startTime) {
      payload.start = { dateTime: `${form.startDate}T${form.startTime}:00`, timeZone: 'Asia/Seoul' };
      payload.end = { dateTime: `${form.endDate || form.startDate}T${form.endTime || form.startTime}:00`, timeZone: 'Asia/Seoul' };
    } else {
      // 종일 일정: 구글은 종료일을 "다음날"로 요구함
      // 🔑 toISOString()은 UTC 변환이라 하루가 밀리므로, 로컬 날짜값으로 직접 계산 (읽기 쪽과 동일한 방식)
      const [ey, em, ed] = (form.endDate || form.startDate).split('-').map(Number);
      const endDateObj = new Date(ey, em - 1, ed);
      endDateObj.setDate(endDateObj.getDate() + 1);
      payload.start = { date: form.startDate };
      payload.end = { date: formatDateString(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate()) };
    }
    return payload;
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const formatDateString = useCallback((y, m, d) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }, []);

  const selectedDateStr = useMemo(() => 
    formatDateString(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()), 
  [selectedDate]);

  const [events, setEvents] = useState([]);
  const [syncStatus, setSyncStatus] = useState('initializing');

  // 🔑 [신규] 여러 개의 독립된 공유 캘린더 관리
  const [calendarList, setCalendarList] = useState([{ id: 'default', name: '2학년실 캘린더' }]); // 🔑 공유 캘린더 목록 (Firestore)
  const [personalCalendarList, setPersonalCalendarList] = useState([]); // 🔑 [신규] 개인 캘린더 목록 (localStorage)
  const [currentCalendarId, setCurrentCalendarId] = useState('default');
  const [newCalendarIsPersonal, setNewCalendarIsPersonal] = useState(false); // 🔑 [신규] 생성 시 공유/개인 선택
  const isPersonalCalendarId = (id) => personalCalendarList.some((c) => c.id === id); // 🔑 [신규]

  // 🔑 [신규] 개인 캘린더의 일정 목록을 localStorage에 저장 + 화면 상태(events)도 함께 갱신
  const savePersonalCalendarEvents = (calendarId, updatedEvents) => {
    localStorage.setItem(`personal_calendar_events_${calendarId}`, JSON.stringify(updatedEvents));
    setEvents(updatedEvents);
  };
  const [isCalendarSwitcherOpen, setIsCalendarSwitcherOpen] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');

  // 🔑 [신규] 구글 캘린더 개인 연동 — 다른 선생님과 공유되지 않는 개인 전용 탭
  const [googleAccountEmail, setGoogleAccountEmail] = useState(null);
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);

  const [categories, setCategories] = useState({
    '교무회의': NOTION_PALETTES.red,
    '학사일정': NOTION_PALETTES.blue,
    '연수/출장': NOTION_PALETTES.yellow,
    '행사/축제': NOTION_PALETTES.green,
    '급식/보건': NOTION_PALETTES.purple,
    '공동업무': NOTION_PALETTES.orange,
    '기타': NOTION_PALETTES.gray
  });

  const [todayNotice, setTodayNotice] = useState({
    words: [{ text: '', author: '' }],
    ddayLabel: '',
    ddayTarget: ''
  });

  const [activeNoticeIdx, setActiveNoticeIdx] = useState(0);
  const [activeCategoryFilters, setActiveCategoryFilters] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCategoryManageOpen, setIsCategoryManageOpen] = useState(false);
  const [isNoticeEditOpen, setIsNoticeEditOpen] = useState(false);
  const [isDdayEditOpen, setIsDdayEditOpen] = useState(false);

  const [isAddCatDropdownOpen, setIsAddCatDropdownOpen] = useState(false);
  const [isEditCatDropdownOpen, setIsEditCatDropdownOpen] = useState(false);
  const [isAddColorPickerOpen, setIsAddColorPickerOpen] = useState(false);
  const [isEditColorPickerOpen, setIsEditColorPickerOpen] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState(null);

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');

  const [newEvent, setNewEvent] = useState({
    title: '', category: '교무회의', manager: '',
    startDate: '', endDate: '', startTime: '', endTime: '', location: '', applyMethod: '', applyCount: '', memo: '', colorId: ''
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editEventForm, setEditEventForm] = useState({
    id: '', title: '', category: '교무회의', manager: '', startDate: '', endDate: '',
    startTime: '', endTime: '', location: '', applyMethod: '', applyCount: '', memo: '', colorId: ''
  });

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryShowAsBadge, setNewCategoryShowAsBadge] = useState(false); // 🔑 [신규] 날짜 옆 배지 표시 여부
  const [selectedPaletteKey, setSelectedPaletteKey] = useState('red');
  const [editingCategoryName, setEditingCategoryName] = useState(null); // 🔑 현재 수정 중인 카테고리의 원래 이름
  const [draggedCategoryName, setDraggedCategoryName] = useState(null); // 🔑 드래그 중인 카테고리명
  const [dragOverCategoryName, setDragOverCategoryName] = useState(null); // 🔑 현재 호버된 카테고리명 (애니메이션용)
  const [categoryOrder, setCategoryOrder] = useState([]); // 🔑 카테고리 표시 순서(Firestore 맵은 순서 보장 안 되므로 배열로 별도 관리)
  const lastCategoryOrderRef = useRef(null); // 🔑 드래그 종료 시 1회만 Firestore에 커밋
  const [noticeFormList, setNoticeFormList] = useState([{ text: '', author: '' }]);
  const [ddayForm, setDdayForm] = useState({ label: '', date: '' });

  const [messengerInput, setMessengerInput] = useState('');
  const [parsedProposals, setParsedProposals] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [activeProposalCatDropdownId, setActiveProposalCatDropdownId] = useState(null);
  const [draggedEventId, setDraggedEventId] = useState(null);
  const [editingProposalId, setEditingProposalId] = useState(null); // 🔑 분석 카드 수정 모드 추적

  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isMoveLocked, setIsMovelocked] = useState(false);
  const [opacityValue, setOpacityValue] = useState(1.0);
  const [isOpacityDropdownOpen, setIsOpacityDropdownOpen] = useState(false);

  const neisConfig = { 
    key: import.meta.env.VITE_NEIS_API_KEY, 
    officeCode: import.meta.env.VITE_NEIS_OFFICE_CODE, 
    schoolCode: import.meta.env.VITE_NEIS_SCHOOL_CODE 
  };
  const [meals, setMeals] = useState({});
  const [activeSidePanel, setActiveSidePanel] = useState([]); // 🔑 [수정] 여러 패널 동시에 열 수 있도록 배열로 변경
  const MAX_OPEN_SIDE_PANELS = 3;

  // 🌟 [추가 상태] 실시간으로 공유될 전역 교사/학급 시간표 통합 매트릭스 원격 상태 선언
  const [customTimetables, setCustomTimetables] = useState({ classes: {}, teachers: {} });

  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem('school_calendar_bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newBookmarkTitle, setNewBookmarkTitle] = useState('');
  const [newBookmarkUrl, setNewBookmarkUrl] = useState('');

  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [updateInfo, setUpdateInfo] = useState({ status: 'idle' }); // 🔑 idle | available | downloading | downloaded | error
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isGradesDashboardOpen, setIsGradesDashboardOpen] = useState(false); // 🔑 학생 성적 대시보드 모달
  const [usefulLinks, setUsefulLinks] = useState([]); // 🔑 [신규] 전교 공유 링크 목록 (Firestore 실시간 동기화)
  const [editingLinkId, setEditingLinkId] = useState(null); // 🔑 수정 중인 링크 id (null이면 신규 등록 폼)
  const [linkFormTitle, setLinkFormTitle] = useState('');
  const [linkFormDesc, setLinkFormDesc] = useState('');
  const [linkFormUrl, setLinkFormUrl] = useState('');
  const [isLinkFormOpen, setIsLinkFormOpen] = useState(false);
  // 🔑 [신규] 담임반/본인 이름 — 시간표·성적분석에서 자동 선택용 (이 PC에만 저장)
  const [myClassNum, setMyClassNum] = useState(() => localStorage.getItem('my_class_num') || '');
  const [myTeacherName, setMyTeacherName] = useState(() => localStorage.getItem('my_teacher_name') || '');

  const handleSaveMyInfo = (classNum, teacherName) => {
    setMyClassNum(classNum);
    setMyTeacherName(teacherName);
    localStorage.setItem('my_class_num', classNum);
    localStorage.setItem('my_teacher_name', teacherName);
    showToast("내 정보가 저장되었습니다.", "success");
  };

  const [myClassNumInput, setMyClassNumInput] = useState(myClassNum);
  const [myTeacherNameInput, setMyTeacherNameInput] = useState(myTeacherName);

  // 🔑 [신규] 야자감독 구글시트 자동 동기화
  const [sheetSyncConfig, setSheetSyncConfig] = useState(null); // { spreadsheetId, calendarName }
  const [sheetSyncIdInput, setSheetSyncIdInput] = useState('');
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [isEditingSheetSyncId, setIsEditingSheetSyncId] = useState(false); // 🔑 [신규] ID 수정 모드 여부
  const [isGeminiSectionOpen, setIsGeminiSectionOpen] = useState(false); // 🔑 Gemini API 키 설정, 평소엔 접혀있음
  const handleCloseGradesDashboard = useCallback(() => setIsGradesDashboardOpen(false), []); // 🔑 매초 재생성 방지

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (activeCategoryFilters.length > 0 && !activeCategoryFilters.includes(event.category)) return false;
      return true;
    });
  }, [events, activeCategoryFilters]);

  // 🔑 구글 일정은 Firestore 카테고리 목록에 없으니, 화면 표시용으로만 파란색 스타일을 병합
  const displayCategories = useMemo(() => ({ ...categories, '구글 일정': NOTION_PALETTES.blue }), [categories]);

  const showToast = (message, type = 'info') => {
    toast // 미사용 방지 더미 조건부
    setToast({ show: true, message, type });
    setTimeout(() => { setToast({ show: false, message: '', type: 'info' }); }, 3000);
  };

  // 실시간 1초 디지털 시계 작동 이펙트
  useEffect(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const updateClock = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setCurrentTimeStr(`${hh}:${mm}:${ss}`);
      setCurrentDateStr(`${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${days[now.getDay()]})`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { localStorage.setItem('school_calendar_bookmarks', JSON.stringify(bookmarks)); }, [bookmarks]);

  // 🔑 [신규] 개인 캘린더 목록 불러오기 (이 컴퓨터에만 저장)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('personal_calendars_list');
      if (saved) setPersonalCalendarList(JSON.parse(saved));
    } catch (e) {
      // 무시
    }
  }, []);

  // 🔑 [신규] 앱 버전 정보를 받아와 헤더에 표시
  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(setAppVersion).catch(() => {});
    }
  }, []);

  // 🔑 [신규] 이전에 연결해둔 구글 계정이 있는지 확인 (이 PC에만 저장된 정보)
  useEffect(() => {
    if (window.electronAPI?.googleGetAccount) {
      window.electronAPI.googleGetAccount().then((account) => {
        if (account) setGoogleAccountEmail(account.email);
      }).catch(() => {});
    }
  }, []);

  // 🔑 [신규] main.js에서 보내주는 업데이트 상태(있음/다운로드중/완료 등)를 구독
  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return;
    const unsubscribe = window.electronAPI.onUpdateStatus((data) => {
      setUpdateInfo(data);
    });
    return unsubscribe;
  }, []);

  const handleStartUpdateDownload = () => {
    window.electronAPI?.startUpdateDownload();
  };

  const handleQuitAndInstall = () => {
    window.electronAPI?.quitAndInstallUpdate();
  };

  useEffect(() => {
    const activeKeys = Object.keys(categories);
    if (activeKeys.length > 0) {
      if (!activeKeys.includes(newEvent.category)) setNewEvent(prev => ({ ...prev, category: activeKeys[0] }));
      if (isEditing && !activeKeys.includes(editEventForm.category)) setEditEventForm(prev => ({ ...prev, category: activeKeys[0] }));
    }
  }, [categories, isEditing, editEventForm.category, newEvent.category]);

  // 파이어베이스 실시간 스트리밍 및 동기화 구축
  useEffect(() => {
    const initFirebaseConnection = async () => {
      try {
        setSyncStatus('connecting'); await initAnonymousAuth(); setSyncStatus('connected');
      } catch (err) {
        setSyncStatus('local');
        const savedEvents = localStorage.getItem('local_school_events');
        if (savedEvents) setEvents(JSON.parse(savedEvents));
      }
    };
    initFirebaseConnection();
  }, []);

  useEffect(() => {
    if (currentCalendarId === 'google') return; // 🔑 구글 캘린더는 별도 이펙트에서 처리

    // 🔑 [신규] 개인 캘린더면 Firestore 대신 이 컴퓨터에 저장된 데이터를 사용
    if (isPersonalCalendarId(currentCalendarId)) {
      try {
        const saved = localStorage.getItem(`personal_calendar_events_${currentCalendarId}`);
        setEvents(saved ? JSON.parse(saved) : []);
      } catch (e) {
        setEvents([]);
      }
      return;
    }

    if (syncStatus !== 'connected' || !db) return;
    return onSnapshot(getEventsCollectionRef(currentCalendarId), (snapshot) => {
      const items = []; snapshot.forEach((doc) => { items.push({ id: doc.id, ...doc.data() }); });
      setEvents(items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    });
  }, [syncStatus, currentCalendarId, personalCalendarList]);

  // 🔑 [신규] 유용한 기능 링크 — 전교 공유, 실시간 동기화
  useEffect(() => {
    if (syncStatus !== 'connected' || !db) return;
    const linksRef = collection(db, 'artifacts', appId, 'public', 'data', 'usefulLinks');
    return onSnapshot(linksRef, (snapshot) => {
      const items = []; snapshot.forEach((doc) => { items.push({ id: doc.id, ...doc.data() }); });
      setUsefulLinks(items.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
    });
  }, [syncStatus]);

  // 🔑 [신규] 야자감독 구글시트 동기화 설정 — 전교 공유
  useEffect(() => {
    if (syncStatus !== 'connected' || !db) return;
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'sheet_sync'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSheetSyncConfig(data);
        setSheetSyncIdInput(data.spreadsheetId || '');
      }
    });
  }, [syncStatus]);

  // 🔑 [신규] "내 구글 캘린더" 탭을 보고 있을 때, 현재 보이는 달 기준(+여유 7일)으로 구글 일정을 불러옴
  const fetchGoogleEvents = async () => {
    if (!window.electronAPI?.googleListEvents) return;
    const rangeStart = new Date(year, month, 1);
    rangeStart.setDate(rangeStart.getDate() - 7);
    const rangeEnd = new Date(year, month + 1, 0);
    rangeEnd.setDate(rangeEnd.getDate() + 7);
    try {
      const gEvents = await window.electronAPI.googleListEvents({
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
      });
      setEvents(gEvents.map(mapGoogleEventToInternal));
    } catch (err) {
      console.error("구글 일정 조회 실패:", err);
      showToast("구글 일정을 불러오지 못했습니다.", "error");
    }
  };

  useEffect(() => {
    if (currentCalendarId === 'google' && googleAccountEmail) {
      fetchGoogleEvents();
    }
  }, [currentCalendarId, googleAccountEmail, year, month]);

  useEffect(() => {
    if (syncStatus !== 'connected' || !db) return;
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'calendars', 'list'), (snapshot) => {
      const savedList = snapshot.exists() && Array.isArray(snapshot.data().items) ? snapshot.data().items : [];
      const hasDefault = savedList.some(c => c.id === 'default');
      const mergedList = hasDefault ? savedList : [{ id: 'default', name: '2학년실 캘린더' }, ...savedList];
      setCalendarList(mergedList);
      if (!hasDefault) {
        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'calendars', 'list'), { items: mergedList });
      }
    });
  }, [syncStatus]);

  useEffect(() => {
    if (syncStatus !== 'connected' || !db) return;
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'categories', 'active_list'), (snapshot) => {
      if (!snapshot.exists()) return;
      const { __order, ...categoryMap } = snapshot.data();
      setCategories(categoryMap);

      // 저장된 순서 배열 중 실제 존재하는 카테고리만 남기고, 순서 배열에 없는 새 카테고리는 뒤에 추가
      const savedOrder = Array.isArray(__order) ? __order : [];
      const validOrder = savedOrder.filter(name => categoryMap[name]);
      const missingNames = Object.keys(categoryMap).filter(name => !validOrder.includes(name));
      setCategoryOrder([...validOrder, ...missingNames]);
    });
  }, [syncStatus]);

  useEffect(() => {
    if (syncStatus !== 'connected' || !db) return;
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'notices', 'board'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setTodayNotice({
          words: data.words || [{ text: '', author: '' }],
          ddayLabel: data.ddayLabel || '',
          ddayTarget: data.ddayTarget || ''
        });
      }
    });
  }, [syncStatus]);

  useEffect(() => {
    if (syncStatus !== 'connected' || !db) return;
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'gemini'), (snapshot) => {
      if (snapshot.exists()) { setGeminiApiKey(snapshot.data().apiKey || ''); setTempApiKey(snapshot.data().apiKey || ''); }
    });
  }, [syncStatus]);

  // 🌟 [기능 추가] 전교 교사 실시간 공유 시간표 도큐먼트 구독 처리 이벤트 수립
  useEffect(() => {
    if (syncStatus !== 'connected' || !db) return;
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school_global_timetables'), (snapshot) => {
      if (snapshot.exists()) {
        setCustomTimetables(snapshot.data());
      } else {
        setCustomTimetables({ classes: {}, teachers: {} });
      }
    });
  }, [syncStatus]);

  // 🔑 [수정] 문서 전체를 덮어쓰지 않고, 바뀐 반/교사 한 명의 시간표만 부분 병합(merge)
  // merge:true는 중첩 객체도 필드 단위로 깊게 병합하므로, 다른 반/교사의 데이터는 전혀 건드리지 않음
  // → 여러 선생님이 동시에 서로 다른 반/교사 시간표를 수정해도 서로 덮어쓰지 않음
  const handleUpdateGlobalTimetables = async (bucketKey, targetKeyName, gridData) => {
    setCustomTimetables(prev => ({
      ...prev,
      [bucketKey]: { ...(prev[bucketKey] || {}), [targetKeyName]: gridData }
    }));

    if (syncStatus === 'connected' && db) {
      try {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school_global_timetables'),
          { [bucketKey]: { [targetKeyName]: gridData } },
          { merge: true }
        );
      } catch (err) {
        console.error("원격 시간표 동기화 실패: ", err);
      }
    }
  };

  // 🔑 [신규] 반/교사 시간표 개별 삭제 (Firestore 필드 자체를 삭제해야 하므로 deleteField 사용)
  const handleDeleteGlobalTimetable = async (bucketKey, targetKeyName) => {
    setCustomTimetables(prev => {
      const updatedBucket = { ...(prev[bucketKey] || {}) };
      delete updatedBucket[targetKeyName];
      return { ...prev, [bucketKey]: updatedBucket };
    });

    if (syncStatus === 'connected' && db) {
      try {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school_global_timetables'),
          { [bucketKey]: { [targetKeyName]: deleteField() } },
          { merge: true }
        );
      } catch (err) {
        console.error("원격 시간표 삭제 실패: ", err);
      }
    }
  };

  useEffect(() => {
    if (!todayNotice.words || todayNotice.words.length <= 1) { setActiveNoticeIdx(0); return; }
    const interval = setInterval(() => { setActiveNoticeIdx(prev => (prev + 1) % todayNotice.words.length); }, 4000);
    return () => clearInterval(interval);
  }, [todayNotice.words]);

  useEffect(() => { fetchNeisMealData(year, month); }, [year, month]);

  // 나이스 급식 API 연동부 
  const fetchNeisMealData = async (targetYear, targetMonth) => {
    const formattedMonth = String(targetMonth + 1).padStart(2, '0');
    const yyyymm = `${targetYear}${formattedMonth}`;
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${neisConfig.key}&Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${neisConfig.officeCode}&SD_SCHUL_CODE=${neisConfig.schoolCode}&MLSV_YMD=${yyyymm}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.mealServiceDietInfo && data.mealServiceDietInfo[1].row) {
        const rows = data.mealServiceDietInfo[1].row;
        const mealMap = {};
        rows.forEach(row => {
          const dateKey = `${row.MLSV_YMD.substring(0,4)}-${row.MLSV_YMD.substring(4,6)}-${row.MLSV_YMD.substring(6,8)}`;
          const cleanDiet = row.DDISH_NM.replace(/\([^()]*\)/g, '').replace(/<br\s*\/?>/gi, '\n').trim();
          if (!mealMap[dateKey]) mealMap[dateKey] = { lunch: null, dinner: null };
          if (row.MMEAL_SC_CODE === "2") mealMap[dateKey].lunch = { diet: cleanDiet, calories: row.CAL_INFO };
          if (row.MMEAL_SC_CODE === "3") mealMap[dateKey].dinner = { diet: cleanDiet, calories: row.CAL_INFO };
        });
        setMeals(mealMap);
      } else { setMeals({}); }
    } catch (err) { console.error("나이스 급식 수신 실패:", err); setMeals({}); }
  };

  // 윈도우 프레임 및 상태 변경 핸들러
  const handleToggleAlwaysOnTop = () => { setIsAlwaysOnTop(!isAlwaysOnTop); window.electronAPI?.setAlwaysOnTop(!isAlwaysOnTop); };
  const handleToggleMoveLock = () => { setIsMovelocked(!isMoveLocked); window.electronAPI?.setMovable(isMoveLocked); };
  const handleOpacityChange = (value) => { setOpacityValue(value); window.electronAPI?.setOpacity(value); };
  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();
  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => { setCurrentDate(new Date()); setSelectedDate(new Date()); };
  const toggleSidePanel = (panelName) => {
    setActiveSidePanel(prev => {
      if (prev.includes(panelName)) return prev.filter(p => p !== panelName);
      if (prev.length >= MAX_OPEN_SIDE_PANELS) {
        showToast(`패널은 최대 ${MAX_OPEN_SIDE_PANELS}개까지 열 수 있습니다.`, "error");
        return prev;
      }
      return [...prev, panelName];
    });
  };

  // 🔑 [신규] 개별 패널만 닫는 헬퍼 (각 카드의 X 버튼에서 사용)
  const closeSidePanel = (panelName) => setActiveSidePanel(prev => prev.filter(p => p !== panelName));

  // 🔑 [신규] 캘린더 생성/삭제/전환
  const handleCreateCalendar = async () => {
    const trimmed = newCalendarName.trim();
    if (!trimmed) return showToast("캘린더 이름을 입력해 주세요.", "error");
    const newCalendar = { id: crypto.randomUUID(), name: trimmed };

    if (newCalendarIsPersonal) {
      // 🔑 [신규] 개인 캘린더 — 이 컴퓨터에만 저장, 다른 선생님은 모름
      const updated = [...personalCalendarList, { ...newCalendar, isPersonal: true }];
      setPersonalCalendarList(updated);
      localStorage.setItem('personal_calendars_list', JSON.stringify(updated));
    } else {
      const updatedList = [...calendarList, newCalendar];
      setCalendarList(updatedList);
      if (syncStatus === 'connected' && db) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'calendars', 'list'), { items: updatedList });
      }
    }

    setNewCalendarName('');
    setNewCalendarIsPersonal(false);
    setCurrentCalendarId(newCalendar.id);
    setIsCalendarSwitcherOpen(false);
    showToast(`'${trimmed}' 캘린더가 생성되었습니다.`, "success");
  };

  const handleDeleteCalendarEntry = async (calendarId) => {
    // 🔑 [신규] 개인 캘린더 삭제 — 목록과 저장된 일정을 함께 제거
    if (isPersonalCalendarId(calendarId)) {
      const updated = personalCalendarList.filter(c => c.id !== calendarId);
      setPersonalCalendarList(updated);
      localStorage.setItem('personal_calendars_list', JSON.stringify(updated));
      localStorage.removeItem(`personal_calendar_events_${calendarId}`);
      if (currentCalendarId === calendarId) setCurrentCalendarId('default');
      showToast("개인 캘린더가 삭제되었습니다.", "info");
      return;
    }

    if (calendarList.length <= 1) return showToast("최소 1개 이상의 캘린더가 유지되어야 합니다.", "error");
    const updatedList = calendarList.filter(c => c.id !== calendarId);
    setCalendarList(updatedList);
    if (currentCalendarId === calendarId) setCurrentCalendarId(updatedList[0].id);
    if (syncStatus === 'connected' && db) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'calendars', 'list'), { items: updatedList });
    }
    showToast("캘린더가 목록에서 제거되었습니다. (기존 일정 데이터는 보존됩니다)", "info");
  };

  const handleSwitchCalendar = (calendarId) => {
    setCurrentCalendarId(calendarId);
    setIsCalendarSwitcherOpen(false);
  };

  // 🔑 [신규] 구글 계정 연결 (시스템 브라우저에서 로그인 진행)
  const handleGoogleConnect = async () => {
    if (!window.electronAPI?.googleConnect) return;
    setIsGoogleConnecting(true);
    try {
      const result = await window.electronAPI.googleConnect();
      setGoogleAccountEmail(result.email);
      showToast(`${result.email} 계정이 연결되었습니다.`, "success");
    } catch (err) {
      console.error("구글 계정 연결 실패:", err);
      showToast("구글 계정 연결에 실패했습니다.", "error");
    } finally {
      setIsGoogleConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!window.electronAPI?.googleDisconnect) return;
    await window.electronAPI.googleDisconnect();
    setGoogleAccountEmail(null);
    if (currentCalendarId === 'google') setCurrentCalendarId('default');
    showToast("구글 계정 연결이 해제되었습니다.", "info");
  };

  const handleSwitchToGoogleCalendar = () => {
    setCurrentCalendarId('google');
    setIsCalendarSwitcherOpen(false);
  };

  // 🔑 [최적화] 드래그 중 화면 미리보기 전용: 로컬 state만 즉시 갱신, Firestore 쓰기 없음
  const handleEventOrderPreview = (updatedOrders) => {
    setEvents(prevEvents => prevEvents.map(ev => {
      const match = updatedOrders.find(o => o.id === ev.id);
      return match ? { ...ev, dayOrder: match.updatedOrder } : ev;
    }));
  };

  // 🔑 [최적화] 드래그가 끝난 시점에 CalendarBoard가 딱 1번 호출: 여기서만 Firestore/로컬스토리지에 저장
  const handleEventOrderCommit = async (updatedOrders) => {
    // 🔑 [신규] 개인 캘린더
    if (isPersonalCalendarId(currentCalendarId)) {
      const updated = events.map(ev => {
        const match = updatedOrders.find(o => o.id === ev.id);
        return match ? { ...ev, dayOrder: match.updatedOrder } : ev;
      });
      savePersonalCalendarEvents(currentCalendarId, updated);
      return;
    }

    if (syncStatus === 'connected' && db) {
      try {
        const batch = writeBatch(db);
        const eventsRef = getEventsCollectionRef(currentCalendarId);
        updatedOrders.forEach(item => {
          const eventDocRef = doc(eventsRef, item.id);
          batch.update(eventDocRef, { dayOrder: item.updatedOrder });
        });
        await batch.commit();
      } catch (err) {
        console.error("Firestore 순서 저장 실패:", err);
        showToast("순서 동기화 중 오류가 발생했습니다.", "error");
      }
    } else {
      setEvents(prevEvents => {
        const latestEvents = prevEvents.map(ev => {
          const match = updatedOrders.find(o => o.id === ev.id);
          return match ? { ...ev, dayOrder: match.updatedOrder } : ev;
        });
        localStorage.setItem('local_school_events', JSON.stringify(latestEvents));
        return latestEvents;
      });
    }
  };

  // 🔑 모달을 닫을 때 폼과 수정모드 상태를 함께 초기화
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setEditingProposalId(null);
    setNewEvent({ title: '', category: Object.keys(categories)[0] || '기타', manager: '', startDate: '', endDate: '', startTime: '', endTime: '', location: '', applyMethod: '', applyCount: '', memo: '' });
  };

  // 🔑 AI 분석 카드를 수정 모달에 채워서 열기
  const handleEditProposal = (proposal) => {
    setNewEvent({
      title: proposal.title || '',
      category: proposal.category || (Object.keys(categories)[0] || '기타'),
      manager: proposal.manager || '',
      startDate: proposal.startDate || '',
      endDate: proposal.endDate || '',
      startTime: proposal.startTime || '',
      endTime: proposal.endTime || '',
      location: proposal.location || '',
      applyMethod: proposal.applyMethod || '',
      applyCount: proposal.applyCount || '',
      memo: proposal.memo || ''
    });
    setEditingProposalId(proposal.id);
    setIsAddModalOpen(true);
  };

  // 🔑 [신규] 하루짜리 일정을 다른 날짜로 드래그하여 이동
  const handleEventDateMove = async (eventId, newDateStr) => {
    const movingEvent = events.find(ev => ev.id === eventId);
    if (!movingEvent) return;

    if (currentCalendarId === 'google') {
      try {
        const updatedForm = { ...movingEvent, startDate: newDateStr, endDate: newDateStr };
        await window.electronAPI.googleUpdateEvent({ eventId, eventData: mapInternalToGoogleEvent(updatedForm) });
        fetchGoogleEvents();
      } catch (err) {
        console.error("구글 일정 날짜 이동 실패:", err);
        showToast("일정 이동에 실패했습니다.", "error");
      }
      return;
    }

    // 🔑 이동할 날짜의 맨 아래(가장 마지막 순서)로 배치
    const targetDayEvents = events.filter(ev => ev.startDate === newDateStr && ev.endDate === newDateStr && ev.id !== eventId);
    const updatedDayOrder = { ...(movingEvent.dayOrder || {}), [newDateStr]: targetDayEvents.length };

    if (syncStatus === 'connected' && db) {
      try {
        await setDoc(doc(getEventsCollectionRef(currentCalendarId), eventId), { startDate: newDateStr, endDate: newDateStr, dayOrder: updatedDayOrder }, { merge: true });
      } catch (err) {
        console.error("일정 날짜 이동 실패:", err);
        showToast("일정 이동에 실패했습니다.", "error");
      }
    } else {
      setEvents(prev => {
        const updated = prev.map(ev => ev.id === eventId ? { ...ev, startDate: newDateStr, endDate: newDateStr, dayOrder: updatedDayOrder } : ev);
        localStorage.setItem('local_school_events', JSON.stringify(updated));
        return updated;
      });
    }
  };

  // 🔑 [신규] 유용한 기능 링크 등록/수정
  const handleSaveUsefulLink = async () => {
    const title = linkFormTitle.trim();
    const url = linkFormUrl.trim();
    if (!title || !url) return showToast("제목과 링크 주소를 입력해 주세요.", "error");

    const payload = { title, description: linkFormDesc.trim(), url, createdAt: editingLinkId ? undefined : new Date().toISOString() };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    if (syncStatus === 'connected' && db) {
      const linksRef = collection(db, 'artifacts', appId, 'public', 'data', 'usefulLinks');
      if (editingLinkId) {
        await setDoc(doc(linksRef, editingLinkId), payload, { merge: true });
      } else {
        await setDoc(doc(linksRef), payload);
      }
    }
    setLinkFormTitle(''); setLinkFormDesc(''); setLinkFormUrl(''); setEditingLinkId(null); setIsLinkFormOpen(false);
    showToast(editingLinkId ? "수정되었습니다." : "등록되었습니다.", "success");
  };

  const handleDeleteUsefulLink = async (id) => {
    if (!window.confirm("이 링크를 삭제할까요?")) return;
    if (syncStatus === 'connected' && db) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'usefulLinks', id));
    }
  };

  const handleStartEditLink = (link) => {
    setEditingLinkId(link.id);
    setLinkFormTitle(link.title);
    setLinkFormDesc(link.description || '');
    setLinkFormUrl(link.url);
    setIsLinkFormOpen(true);
  };

  const handleStartNewLink = () => {
    setEditingLinkId(null);
    setLinkFormTitle(''); setLinkFormDesc(''); setLinkFormUrl('');
    setIsLinkFormOpen(true);
  };

  // 🔑 [신규] 야자감독 구글시트 동기화 설정 저장 (전교 공유)
  const handleSaveSheetSyncConfig = async () => {
    const spreadsheetId = sheetSyncIdInput.trim();
    if (!spreadsheetId) return showToast("스프레드시트 ID를 입력해 주세요.", "error");
    if (syncStatus === 'connected' && db) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'sheet_sync'), { spreadsheetId, calendarName: '야자감독' }, { merge: true });
    }
    setIsEditingSheetSyncId(false);
    showToast("동기화 설정이 저장되었습니다.", "success");
  };

  // 🔑 Google Sheets API v4로 전체 탭 목록을 조회해서, keyword가 포함된 첫 번째 탭의 실제 이름을 반환
  const findSheetTabTitleByKeyword = async (spreadsheetId, keyword) => {
    const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
    if (!apiKey) throw new Error('Google Sheets API 키가 설정되어 있지 않습니다.');
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title&key=${apiKey}`;
    const res = await fetch(metaUrl);
    if (!res.ok) throw new Error('시트 목록을 불러오지 못했습니다. 공유 설정 또는 API 키를 확인해주세요.');
    const data = await res.json();
    const titles = (data.sheets || []).map((s) => s.properties.title);
    return titles.find((t) => t.includes(keyword)) || null;
  };

  // 🔑 [신규] 구글시트에서 야자감독 배정표를 읽어와 "야자감독" 캘린더에 자동 반영
  const handleSyncFromGoogleSheet = useCallback(async (config, targetYear, targetMonth) => {
    if (!config || !config.spreadsheetId) return;

    setIsSyncingSheet(true);
    try {
      // 🔑 1단계: "N월"이 포함된 탭 이름을 정확히 찾음
      const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
      if (!apiKey) throw new Error('Google Sheets API 키가 설정되어 있지 않습니다.');
      const monthLabel = `${targetMonth + 1}월`;
      const tabTitle = await findSheetTabTitleByKeyword(config.spreadsheetId, monthLabel);
      if (!tabTitle) throw new Error(`"${monthLabel}"이 포함된 탭을 찾을 수 없습니다.`);

      // 🔑 2단계: 셀 값 + 서식(취소선 등)을 함께 조회 (Sheets API v4, includeGridData)
      const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}?ranges=${encodeURIComponent(tabTitle)}&includeGridData=true&fields=sheets.data.rowData.values(formattedValue,effectiveFormat.textFormat.strikethrough)&key=${apiKey}`;
      const res = await fetch(dataUrl);
      if (!res.ok) throw new Error('시트를 불러오지 못했습니다. 공유 설정 또는 API 키를 확인해주세요.');
      const data = await res.json();
      const gridRows = data.sheets?.[0]?.data?.[0]?.rowData || [];
      // rows[r][c] = { value: '텍스트', strikethrough: true/false }
      const rows = gridRows.map((rd) =>
        (rd.values || []).map((cell) => ({
          value: (cell.formattedValue || '').trim(),
          strikethrough: !!cell.effectiveFormat?.textFormat?.strikethrough,
        }))
      );

      // "담당교사" 헤더 셀 위치 찾기
      let headerRowIdx = -1, teacherColIdx = -1;
      for (let r = 0; r < rows.length; r++) {
        const c = rows[r].findIndex((cell) => cell.value === '담당교사');
        if (c !== -1) { headerRowIdx = r; teacherColIdx = c; break; }
      }
      if (headerRowIdx === -1) throw new Error('"담당교사" 열을 찾을 수 없습니다.');

      const dateNumberRow = rows[headerRowIdx + 1] || [];
      // 날짜 열 매핑: 1~31 사이 숫자가 있는 열만 날짜 열로 인식
      const dateColMap = {}; // colIdx -> day
      dateNumberRow.forEach((cell, c) => {
        const n = parseInt(cell.value, 10);
        if (n >= 1 && n <= 31) dateColMap[c] = n;
      });

      // 교사 행 스캔: "요일별 합계" 행 전까지
      const dutyMap = {}; // day -> teacherName
      for (let r = headerRowIdx + 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const teacherName = (row[teacherColIdx]?.value || '').trim();
        if (teacherName === '요일별 합계' || teacherName === '') continue;
        if (teacherName.includes('평감독') || teacherName.includes('금감독')) break;

        Object.entries(dateColMap).forEach(([colIdx, day]) => {
          const cell = row[colIdx];
          // 🔑 값이 정확히 "1"이고, 취소선이 없는 경우만 실제 배정으로 인정
          if (cell && cell.value === '1' && !cell.strikethrough) dutyMap[day] = teacherName;
        });
      }

      // 🔑 메인 캘린더("default")에 "야자감독" 카테고리로 저장 → 배지 표시 대상이 됨
      // 이 동기화로 생성된 일정만 안전하게 갱신/정리 (수동 등록 일정은 건드리지 않음)
      const eventsRef = getEventsCollectionRef('default');
      const pad = (n) => String(n).padStart(2, '0');
      const seenIds = new Set();

      for (const [dayStr, teacherName] of Object.entries(dutyMap)) {
        const dateStr = `${targetYear}-${pad(targetMonth + 1)}-${pad(Number(dayStr))}`;
        const eventId = `sheet-duty-${dateStr}`;
        seenIds.add(eventId);
        await setDoc(doc(eventsRef, eventId), {
          title: `${teacherName}T`,
          category: '야자감독',
          manager: teacherName,
          startDate: dateStr,
          endDate: dateStr,
          startTime: '', endTime: '', location: '', applyMethod: '', applyCount: '', memo: '',
          dayOrder: {},
          createdAt: new Date().toISOString(),
          source: 'sheet-sync', // 🔑 이 동기화가 만든 일정임을 표시 (안전한 정리를 위해)
        }, { merge: true });
      }

      // 이번 달에 이 동기화가 예전에 만들었던 일정 중, 지금은 시트에서 사라진 것들 정리
      // (메인 캘린더를 보고 있을 때만 events에 데이터가 있으므로, currentCalendarId가 'default'일 때만 정확히 정리됨)
      const existingSyncedThisMonth = currentCalendarId === 'default'
        ? events.filter((ev) =>
            ev.source === 'sheet-sync' &&
            ev.startDate && ev.startDate.startsWith(`${targetYear}-${pad(targetMonth + 1)}-`)
          )
        : [];
      for (const ev of existingSyncedThisMonth) {
        if (!seenIds.has(ev.id)) {
          await deleteDoc(doc(eventsRef, ev.id));
        }
      }

      showToast("야자감독 일정이 동기화되었습니다.", "success");
    } catch (err) {
      console.error("구글시트 동기화 실패:", err);
      showToast(err.message || "구글시트 동기화에 실패했습니다.", "error");
    } finally {
      setIsSyncingSheet(false);
    }
  }, [calendarList, events]);

  // 🔑 앱을 열 때, 그리고 달을 이동할 때마다 자동으로 동기화
  useEffect(() => {
    if (!sheetSyncConfig || syncStatus !== 'connected') return;
    handleSyncFromGoogleSheet(sheetSyncConfig, year, month);
  }, [sheetSyncConfig, year, month, syncStatus]);

  // 일정 생성 데이터 전송 로직
  const handleAddEventSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!newEvent.title.trim() || !newEvent.startDate) return showToast("제목과 시작일은 필수 항목입니다.", "error");

    // 🔑 분석 카드 수정 모드: Firestore에 바로 저장하지 않고 parsedProposals만 갱신
    if (editingProposalId) {
      setParsedProposals(prev => prev.map(p => p.id === editingProposalId ? { ...p, ...newEvent } : p));
      showToast("분석 일정이 수정되었습니다.", "success");
      handleCloseAddModal();
      return;
    }

    const payload = { ...newEvent, createdAt: new Date().toISOString(), dayOrder: {} };

    if (currentCalendarId === 'google') {
      try {
        await window.electronAPI.googleCreateEvent(mapInternalToGoogleEvent(newEvent));
        showToast("구글 캘린더에 일정이 등록되었습니다.", "success");
        fetchGoogleEvents();
      } catch (err) {
        console.error("구글 일정 등록 실패:", err);
        showToast("구글 일정 등록에 실패했습니다.", "error");
      }
      handleCloseAddModal();
      return;
    }

    // 🔑 [신규] 개인 캘린더 — 이 컴퓨터에만 저장
    if (isPersonalCalendarId(currentCalendarId)) {
      const newEv = { ...payload, id: crypto.randomUUID() };
      savePersonalCalendarEvents(currentCalendarId, [...events, newEv]);
      showToast("일정이 개인 캘린더에 등록되었습니다.", "success");
      handleCloseAddModal();
      return;
    }

    if (syncStatus === 'connected' && db) {
      await setDoc(doc(getEventsCollectionRef(currentCalendarId)), payload);
      showToast("일정이 공유 캘린더에 연동되었습니다.", "success");
    } else { saveLocalEvent({ ...payload, id: crypto.randomUUID() }); }
    
    handleCloseAddModal();
  };

  const handleUpdateEvent = async () => {
    if (currentCalendarId === 'google') {
      try {
        await window.electronAPI.googleUpdateEvent({ eventId: editEventForm.id, eventData: mapInternalToGoogleEvent(editEventForm) });
        showToast("구글 일정이 수정되었습니다.", "success");
        fetchGoogleEvents();
      } catch (err) {
        console.error("구글 일정 수정 실패:", err);
        showToast("구글 일정 수정에 실패했습니다.", "error");
      }
      setIsEditing(false); setIsDetailModalOpen(false);
      return;
    }

    // 🔑 [신규] 개인 캘린더
    if (isPersonalCalendarId(currentCalendarId)) {
      const updated = events.map(ev => ev.id === editEventForm.id ? { ...ev, ...editEventForm } : ev);
      savePersonalCalendarEvents(currentCalendarId, updated);
      setIsEditing(false); setIsDetailModalOpen(false); showToast("수정 완료되었습니다.", "success");
      return;
    }

    if (syncStatus === 'connected' && db) await setDoc(doc(getEventsCollectionRef(currentCalendarId), editEventForm.id), editEventForm, { merge: true });
    else setEvents(events.map(ev => ev.id === editEventForm.id ? { ...ev, ...editEventForm } : ev));
    setIsEditing(false); setIsDetailModalOpen(false); showToast("수정 완료되었습니다.", "success");
  };

  const handleDeleteEvent = async (id) => {
    if (currentCalendarId === 'google') {
      try {
        await window.electronAPI.googleDeleteEvent(id);
        showToast("구글 일정이 삭제되었습니다.", "success");
        fetchGoogleEvents();
      } catch (err) {
        console.error("구글 일정 삭제 실패:", err);
        showToast("구글 일정 삭제에 실패했습니다.", "error");
      }
      setIsDetailModalOpen(false);
      return;
    }

    // 🔑 [신규] 개인 캘린더
    if (isPersonalCalendarId(currentCalendarId)) {
      savePersonalCalendarEvents(currentCalendarId, events.filter(ev => ev.id !== id));
      setIsDetailModalOpen(false); showToast("삭제 완료되었습니다.", "success");
      return;
    }

    if (syncStatus === 'connected' && db) await deleteDoc(doc(getEventsCollectionRef(currentCalendarId), id));
    else setEvents(events.filter(ev => ev.id !== id));
    setIsDetailModalOpen(false); showToast("삭제 완료되었습니다.", "success");
  };

  // 오늘의 한마디 및 디데이 제어
  const handleUpdateNotice = async () => {
    const cleanWords = noticeFormList.map(w => ({ text: w.text.trim(), author: w.author.trim() })).filter(w => w.text);
    const updated = { ...todayNotice, words: cleanWords.length > 0 ? cleanWords : [{ text: '', author: '' }] };
    setTodayNotice(updated); setActiveNoticeIdx(0); setIsNoticeEditOpen(false);
    if (syncStatus === 'connected' && db) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notices', 'board'), updated, { merge: true });
      showToast("오늘의 한마디가 연동 저장되었습니다.", "success");
    }
  };

  const handleUpdateDday = async () => {
    const updated = { ...todayNotice, ddayLabel: ddayForm.label.trim(), ddayTarget: ddayForm.date };
    setTodayNotice(updated); setIsDdayEditOpen(false);
    if (syncStatus === 'connected' && db) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notices', 'board'), updated, { merge: true });
      showToast("디데이 설정이 성공적으로 수정되었습니다.", "success");
    }
  };

  const handleClearDday = async () => {
    const updated = { ...todayNotice, ddayLabel: '', ddayTarget: '' };
    setTodayNotice(updated); setIsDdayEditOpen(false);
    if (syncStatus === 'connected' && db) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notices', 'board'), updated, { merge: true });
      showToast("디데이가 초기화되었습니다.", "info");
    }
  };

  // 북마크 제어 리스너
  const handleAddBookmarkSubmit = (e) => {
    if (e) e.preventDefault();
    if (!newBookmarkTitle.trim() || !newBookmarkUrl.trim()) return;
    let parsedUrl = newBookmarkUrl.trim();
    if (!/^https?:\/\//i.test(parsedUrl)) parsedUrl = `https://${parsedUrl}`;
    setBookmarks([...bookmarks, { id: crypto.randomUUID(), title: newBookmarkTitle.trim(), url: parsedUrl }]);
    setNewBookmarkTitle(''); setNewBookmarkUrl(''); showToast("북마크가 등록되었습니다.", "success");
  };
  const handleDeleteBookmark = (id) => { setBookmarks(bookmarks.filter(b => b.id !== id)); };
  const handleOpenBookmarkUrl = (e, url) => { e.preventDefault(); window.electronAPI ? window.electronAPI.openExternal(url) : window.open(url, '_blank'); };
  
  const handleSaveApiKeyToLocal = () => { localStorage.setItem('user_gemini_api_key', tempApiKey.trim()); setGeminiApiKey(tempApiKey.trim()); showToast("키가 등록되었습니다.", "success"); };
  const handleShareApiKeyToFirestore = async () => { if (syncStatus === 'connected') await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'gemini'), { apiKey: tempApiKey.trim() }); showToast("전체 공유 완료", "success"); };

  // Gemini AI 기반 메신저 일정 분석기
  const handleAnalyzeMessengerText = async () => {
    if (!messengerInput.trim()) return showToast("분석할 안내 내용을 기입해 주세요.", "error");
    if (!geminiApiKey.trim()) return showToast("설정에서 Gemini API Key를 등록해 주세요!", "error");

    setIsAnalyzing(true);
    try {
      const promptPieces = [
        "너는 학교 교무실 업무를 지원하는 완벽한 AI 비서이다.",
        "제공되는 텍스트 하나에는 서로 다른 공지가 1건만 있을 수도 있고, 여러 건이 섞여 있을 수도 있다. 올해는 2026년이다.",
        "1단계: 먼저 텍스트가 몇 개의 서로 다른 '공지 단위'로 구성되어 있는지 파악하라. 번호(1. 2. 3.), 구분선, 빈 줄, 서로 다른 제목 블록으로 나뉘어 있다면 각각 별개의 공지로 간주한다.",
        "2단계: 각 공지 단위 안에서, 성격이 서로 다른 날짜(또는 날짜 범위)가 몇 개나 언급되는지 파악하라. '이 날짜가 가리키는 행동이나 사건이 서로 다른가?'를 기준으로 판단한다. 예를 들어 '신청/접수/제출의 마감일'과 '실제 행사/교육/활동이 열리는 날'은 서로 다른 사건이므로 별개의 날짜로 센다. 같은 공지 안에 심사일, 발표일처럼 제3, 제4의 날짜가 더 있다면 그것도 각각 별개의 날짜로 센다.",
        "3단계: 한 공지 안에 서로 다른 날짜가 N개 있다면, 그 공지에서 N개의 일정 항목을 만든다. 각 항목의 title은 원래 제목에 그 날짜가 가리키는 행동을 짧게 괄호로 덧붙인다(예: '(신청마감)', '(접수기간)', '(심사)', '(발표)' 등 텍스트의 표현을 그대로 살려서 짓는다). 날짜가 실제 행사/활동 자체를 가리키는 항목이라면 원래 제목을 그대로 쓰고 괄호를 붙이지 않는다.",
        "4단계: 장소, 담당자, 신청방법, 신청인원 등 날짜와 무관하게 공통되는 정보는 그 공지에서 만들어진 모든 일정 항목에 동일하게 채운다.",
        "한 공지 안에 날짜가 1개뿐이면 항목도 1개만 만든다. 날짜 종류를 억지로 쪼개지 말고, 실제로 서로 다른 사건을 가리킬 때만 나눈다.",
        "모든 공지에서 만들어진 일정 항목 전체를 하나의 JSON 배열로 응답하라.",
        "오직 아래 명세(배열 형태)만 텍스트로 응답하고, 마크다운 기호(```json)나 설명은 일절 배제하라:",
        "[ { \"title\": \"일정명\", \"startDate\": \"YYYY-MM-DD\", \"endDate\": \"YYYY-MM-DD\", \"startTime\": \"HH:MM\", \"endTime\": \"HH:MM\", \"manager\": \"\", \"location\": \"\", \"applyMethod\": \"\", \"applyCount\": \"\", \"memo\": \"\" } ]"
      ];

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: promptPieces.join("\n") }, { text: `[원문]\n${messengerInput}` }] }] })
        }
      );

      if (!response.ok) throw new Error("API 호출 실패");
      const resData = await response.json();
      const cleanJsonStr = resData.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedArray = JSON.parse(cleanJsonStr);

      if (Array.isArray(parsedArray)) {
        setParsedProposals(parsedArray.map(item => ({ ...item, category: '', id: crypto.randomUUID(), dayOrder: {} })));
        showToast("Gemini AI가 일정을 추출했습니다.", "success");
      }
    } catch (err) { showToast("AI 분석 중 오류가 발생했습니다.", "error"); } finally { setIsAnalyzing(false); }
  };

  const handleUpdateProposalCategory = (id, name) => { setParsedProposals(prev => prev.map(p => p.id === id ? { ...p, category: name } : p)); setActiveProposalCatDropdownId(null); };
  const handleAddSingleProposalCard = async (id) => {
    const card = parsedProposals.find(p => p.id === id);
    if (!card) return;
    if (!card.category) { showToast("카테고리를 선택해 주세요!", "error"); setActiveProposalCatDropdownId(id); return; }
    const payload = { ...card, createdAt: new Date().toISOString(), dayOrder: {} };
    delete payload.id;
    if (syncStatus === 'connected' && db) await setDoc(doc(getEventsCollectionRef(currentCalendarId)), payload);
    setParsedProposals(prev => prev.filter(p => p.id !== id)); showToast("캘린더에 연동 등록했습니다.", "success");
  };

  // 카테고리 추가/수정/삭제/순서변경
  const handleAddCategorySubmit = async () => {
    if (!newCategoryName.trim()) return showToast("카테고리명을 입력해 주세요.", "error");
    const trimmedName = newCategoryName.trim();

    // 🔑 색상 스타일 + 날짜 옆 배지 표시 여부를 함께 저장
    const stylingWithBadge = { ...NOTION_PALETTES[selectedPaletteKey], showAsBadge: newCategoryShowAsBadge };

    if (editingCategoryName) {
      if (trimmedName !== editingCategoryName && categories[trimmedName]) {
        return showToast("이미 존재하는 카테고리입니다.", "error");
      }

      const { [editingCategoryName]: oldStyling, ...restCategories } = categories;
      const updatedCategories = { ...restCategories, [trimmedName]: stylingWithBadge };
      const updatedOrder = categoryOrder.map(name => name === editingCategoryName ? trimmedName : name);

      setCategories(updatedCategories);
      setCategoryOrder(updatedOrder);
      setNewCategoryName('');
      setNewCategoryShowAsBadge(false);
      setEditingCategoryName(null);
      if (syncStatus === 'connected' && db) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', 'active_list'), { ...updatedCategories, __order: updatedOrder });
      showToast("카테고리가 수정되었습니다.", "success");
      return;
    }

    if (categories[trimmedName]) return showToast("이미 존재하는 카테고리입니다.", "error");
    const updatedCategories = { ...categories, [trimmedName]: stylingWithBadge };
    const updatedOrder = [...categoryOrder, trimmedName];
    setCategories(updatedCategories); setCategoryOrder(updatedOrder); setNewCategoryName(''); setNewCategoryShowAsBadge(false);
    if (syncStatus === 'connected' && db) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', 'active_list'), { ...updatedCategories, __order: updatedOrder });
    showToast("카테고리가 추가되었습니다.", "success");
  };

  // 🔑 카테고리를 클릭하면 입력창/색상 선택에 해당 값을 채워 수정 모드로 진입
  const handleSelectCategoryToEdit = (catName) => {
    const styling = categories[catName] || NOTION_PALETTES.gray;
    const matchedPaletteKey = Object.keys(NOTION_PALETTES).find(key => NOTION_PALETTES[key].color === styling.color) || 'red';
    setNewCategoryName(catName);
    setSelectedPaletteKey(matchedPaletteKey);
    setNewCategoryShowAsBadge(!!styling.showAsBadge);
    setEditingCategoryName(catName);
  };

  const handleCancelCategoryEdit = () => {
    setEditingCategoryName(null);
    setNewCategoryName('');
    setSelectedPaletteKey('red');
    setNewCategoryShowAsBadge(false);
  };

  const handleDeleteCategory = async (catName) => {
    if (Object.keys(categories).length <= 1) return showToast("최소 1개 이상의 카테고리가 유지되어야 합니다.", "error");
    const { [catName]: deleted, ...rest } = categories;
    deleted // 미사용 경고 처리 방지
    const updatedOrder = categoryOrder.filter(name => name !== catName);
    setCategories(rest);
    setCategoryOrder(updatedOrder);
    if (editingCategoryName === catName) {
      setEditingCategoryName(null);
      setNewCategoryName('');
    }
    if (syncStatus === 'connected' && db) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', 'active_list'), { ...rest, __order: updatedOrder });
    showToast("카테고리가 삭제되었습니다.", "info");
  };

  // 🔑 카테고리 목록 드래그 앤 드롭 순서 변경 (일정 카드와 동일한 방식: 호버 시 실시간 스왑, 드래그 종료 시 1회 저장)
  const handleCategoryDragStart = (e, catName) => {
    setDraggedCategoryName(catName);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.3';
  };

  const handleCategoryDragEnd = async (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedCategoryName(null);
    setDragOverCategoryName(null);

    if (lastCategoryOrderRef.current && syncStatus === 'connected' && db) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', 'active_list'), { ...categories, __order: lastCategoryOrderRef.current });
    }
    lastCategoryOrderRef.current = null;
  };

  const handleCategoryDragOver = (e) => {
    e.preventDefault();
  };

  const handleCategoryDragEnter = (e, targetCatName) => {
    e.preventDefault();
    if (!draggedCategoryName || draggedCategoryName === targetCatName) return;

    setDragOverCategoryName(targetCatName);

    const draggedIdx = categoryOrder.indexOf(draggedCategoryName);
    const targetIdx = categoryOrder.indexOf(targetCatName);
    if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) return;

    const reorderedOrder = [...categoryOrder];
    const [removed] = reorderedOrder.splice(draggedIdx, 1);
    reorderedOrder.splice(targetIdx, 0, removed);

    lastCategoryOrderRef.current = reorderedOrder;
    setCategoryOrder(reorderedOrder);
  };

  const handleCategoryDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCategoryName(null);
  };

  const saveSingleEventData = async (id, payload) => { if (syncStatus === 'connected' && db) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', id), payload, { merge: true }); };
  saveSingleEventData // 미사용 바인딩 경고 더미 우회

  const activeDayMeal = useMemo(() => meals[selectedDateStr] || null, [meals, selectedDateStr]);
  const calculatedDdayValue = useMemo(() => {
    if (!todayNotice.ddayTarget) return '?';
    const diff = new Date(todayNotice.ddayTarget + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0);
    const d = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return d === 0 ? '─Day' : d > 0 ? `-${d}` : `+${Math.abs(d)}`;
  }, [todayNotice.ddayTarget]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const prevDaysInMonth = new Date(year, month, 0).getDate();

  return (
    <div className="h-screen overflow-hidden bg-[#F7F7F5] text-[#37352F] font-sans antialiased flex flex-col select-none">
      <DashboardHeader 
        syncStatus={syncStatus} isAlwaysOnTop={isAlwaysOnTop} isMoveLocked={isMoveLocked} opacityValue={opacityValue}
        isOpacityDropdownOpen={isOpacityDropdownOpen} setIsOpacityDropdownOpen={setIsOpacityDropdownOpen}
        handleToggleAlwaysOnTop={handleToggleAlwaysOnTop} handleToggleMoveLock={handleToggleMoveLock}
        handleOpacityChange={handleOpacityChange} handleMinimize={handleMinimize} handleMaximize={handleMaximize} handleClose={handleClose}
        appVersion={appVersion}
        updateInfo={updateInfo}
        isUpdateModalOpen={isUpdateModalOpen}
        setIsUpdateModalOpen={setIsUpdateModalOpen}
        handleStartUpdateDownload={handleStartUpdateDownload}
        handleQuitAndInstall={handleQuitAndInstall}
      />

      <div className="flex-1 flex flex-row min-w-0 min-h-0 w-full relative overflow-hidden gap-1.5">
        <div className="flex-1 flex flex-col gap-1.5 p-3 md:p-3.5 min-w-0 min-h-0 overflow-y-auto">
          <TopWidgets 
            todayNotice={todayNotice} activeNoticeIdx={activeNoticeIdx} setActiveNoticeIdx={setActiveNoticeIdx}
            setNoticeFormList={setNoticeFormList} setIsNoticeEditOpen={setIsNoticeEditOpen} calculatedDdayValue={calculatedDdayValue}
            setDdayForm={setDdayForm} setIsDdayEditOpen={setIsDdayEditOpen} currentTimeStr={currentTimeStr} currentDateStr={currentDateStr}
          />

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-1.5 items-start w-full">
            <CalendarBoard 
              year={year} month={month} handlePrevMonth={handlePrevMonth} handleToday={handleToday} handleNextMonth={handleNextMonth}
              setIsCategoryManageOpen={setIsCategoryManageOpen} firstDayIndex={firstDayIndex} prevDaysInMonth={prevDaysInMonth}
              daysInMonth={daysInMonth} filteredEvents={filteredEvents} categories={displayCategories} NOTION_PALETTES={NOTION_PALETTES}
              extractHexColor={extractHexColor} selectedDate={selectedDate} setSelectedDate={setSelectedDate} setNewEvent={setNewEvent}
              setIsAddModalOpen={setIsAddModalOpen} setSelectedEvent={setSelectedEvent} setIsDetailModalOpen={setIsDetailModalOpen}
              formatDateString={formatDateString} activeSidePanel={activeSidePanel.length > 0}
              onEventOrderChange={handleEventOrderPreview}
              onEventOrderCommit={handleEventOrderCommit}
              calendarList={[...calendarList, ...personalCalendarList]} currentCalendarId={currentCalendarId}
              isCalendarSwitcherOpen={isCalendarSwitcherOpen} setIsCalendarSwitcherOpen={setIsCalendarSwitcherOpen}
              newCalendarName={newCalendarName} setNewCalendarName={setNewCalendarName}
              newCalendarIsPersonal={newCalendarIsPersonal} setNewCalendarIsPersonal={setNewCalendarIsPersonal}
              handleCreateCalendar={handleCreateCalendar} handleDeleteCalendarEntry={handleDeleteCalendarEntry}
              handleSwitchCalendar={handleSwitchCalendar}
              googleAccountEmail={googleAccountEmail}
              handleSwitchToGoogleCalendar={handleSwitchToGoogleCalendar}
              onEventDateMove={handleEventDateMove}
            />

            {/* 🔑 [수정] 사이드바만 스크롤 시 화면에 고정되도록 sticky 적용 */}
            <div className="sticky top-3.5 self-start">
            {/* 🌟 [수정 섹션] 전교 교사용 실시간 공유 상태(customTimetables) 및 트리거 주입 연동 */}
            <SideAccordionPanel 
              activeSidePanel={activeSidePanel} setActiveSidePanel={setActiveSidePanel} closeSidePanel={closeSidePanel} selectedDate={selectedDate}
              usefulLinks={usefulLinks} isLinkFormOpen={isLinkFormOpen} setIsLinkFormOpen={setIsLinkFormOpen}
              linkFormTitle={linkFormTitle} setLinkFormTitle={setLinkFormTitle}
              linkFormDesc={linkFormDesc} setLinkFormDesc={setLinkFormDesc}
              linkFormUrl={linkFormUrl} setLinkFormUrl={setLinkFormUrl}
              editingLinkId={editingLinkId}
              handleSaveUsefulLink={handleSaveUsefulLink} handleDeleteUsefulLink={handleDeleteUsefulLink}
              handleStartEditLink={handleStartEditLink} handleStartNewLink={handleStartNewLink}
              activeDayMeal={activeDayMeal} messengerInput={messengerInput} setMessengerInput={setMessengerInput}
              handleAnalyzeMessengerText={handleAnalyzeMessengerText} isAnalyzing={isAnalyzing} parsedProposals={parsedProposals}
              setParsedProposals={setParsedProposals} categories={categories} categoryOrder={categoryOrder} NOTION_PALETTES={NOTION_PALETTES}
              activeProposalCatDropdownId={activeProposalCatDropdownId} setActiveProposalCatDropdownId={setActiveProposalCatDropdownId}
              handleUpdateProposalCategory={handleUpdateProposalCategory} handleAddSingleProposalCard={handleAddSingleProposalCard}
              handleEditProposal={handleEditProposal}
              bookmarks={bookmarks} handleOpenBookmarkUrl={handleOpenBookmarkUrl} handleDeleteBookmark={handleDeleteBookmark}
              newBookmarkTitle={newBookmarkTitle} setNewBookmarkTitle={setNewBookmarkTitle} newBookmarkUrl={newBookmarkUrl}
              setNewBookmarkUrl={setNewBookmarkUrl} handleAddBookmarkSubmit={handleAddBookmarkSubmit}
              customTimetables={customTimetables} onUpdateGlobalTimetables={handleUpdateGlobalTimetables}
              onDeleteGlobalTimetable={handleDeleteGlobalTimetable}
              myClassNum={myClassNum} myTeacherName={myTeacherName}
            />
            </div>
          </div>
        </div>

        {/* 최우측 레이아웃 인덱스 네비게이션 */}
        <div className="w-14 bg-white border-l border-[#E9E9E6] flex flex-col items-center py-4 justify-start gap-5 z-40 shrink-0 window-no-drag shadow-xs">
          <button type="button" onClick={() => toggleSidePanel('meal')} className={`p-2.5 rounded-xl transition-all relative group border ${activeSidePanel.includes('meal') ? 'bg-emerald-50 border-emerald-200 text-emerald-700 scale-105 shadow-xs' : 'border-transparent text-gray-400 hover:bg-[#F7F7F5] hover:text-gray-700'}`}><Utensils className="w-5 h-5" /></button>
          <button type="button" onClick={() => toggleSidePanel('timetable')} className={`p-2.5 rounded-xl transition-all relative group border ${activeSidePanel.includes('timetable') ? 'bg-blue-50 border-blue-200 text-blue-700 scale-105 shadow-xs' : 'border-transparent text-gray-400 hover:bg-[#F7F7F5] hover:text-gray-700'}`}><CalendarIcon className="w-5 h-5" /></button>
          <button type="button" onClick={() => toggleSidePanel('ai')} className={`p-2.5 rounded-xl transition-all relative group border ${activeSidePanel.includes('ai') ? 'bg-purple-50 border-purple-200 text-purple-700 scale-105 shadow-xs' : 'border-transparent text-gray-400 hover:bg-[#F7F7F5] hover:text-gray-700'}`}><Sparkles className="w-5 h-5" /></button>
          <button type="button" onClick={() => toggleSidePanel('bookmark')} className={`p-2.5 rounded-xl transition-all relative group border ${activeSidePanel.includes('bookmark') ? 'bg-blue-50 border-blue-200 text-blue-700 scale-105 shadow-xs' : 'border-transparent text-gray-400 hover:bg-[#F7F7F5] hover:text-gray-700'}`}><Bookmark className="w-5 h-5" /></button>
          <button type="button" onClick={() => toggleSidePanel('salary')} className={`p-2.5 rounded-xl transition-all relative group border ${activeSidePanel.includes('salary') ? 'bg-amber-50 border-amber-200 text-amber-700 scale-105 shadow-xs' : 'border-transparent text-gray-400 hover:bg-[#F7F7F5] hover:text-gray-700'}`}><Wallet className="w-5 h-5" /></button>
          <button type="button" onClick={() => setIsGradesDashboardOpen(true)} className={`p-2.5 rounded-xl transition-all relative group border ${isGradesDashboardOpen ? 'bg-slate-100 border-slate-300 text-slate-700 scale-105 shadow-xs' : 'border-transparent text-gray-400 hover:bg-[#F7F7F5] hover:text-gray-700'}`} title="학생 성적 대시보드"><BarChart3 className="w-5 h-5" /></button>
          <button type="button" onClick={() => toggleSidePanel('tools')} className={`p-2.5 rounded-xl transition-all relative group border ${activeSidePanel.includes('tools') ? 'bg-emerald-50 border-emerald-200 text-emerald-700 scale-105 shadow-xs' : 'border-transparent text-gray-400 hover:bg-[#F7F7F5] hover:text-gray-700'}`} title="공유 도구함"><Link2 className="w-5 h-5" /></button>
          <button type="button" onClick={() => toggleSidePanel('gradeConv')} className={`p-2.5 rounded-xl transition-all relative group border ${activeSidePanel.includes('gradeConv') ? 'bg-rose-50 border-rose-200 text-rose-700 scale-105 shadow-xs' : 'border-transparent text-gray-400 hover:bg-[#F7F7F5] hover:text-gray-700'}`} title="등급 환산 계산기"><Calculator className="w-5 h-5" /></button>
        </div>
      </div>

      {/* 일정 등록 모달창 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E9E9E6] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E9E9E6] pb-3">
              <h3 className="text-base font-bold text-[#37352F] flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-700" /> {editingProposalId ? '분석 일정 수정' : '신규 일정 등록'}
              </h3>
              <button onClick={handleCloseAddModal} className="p-1 hover:bg-gray-100 rounded transition"><X className="w-5 h-5" /></button>
            </div>

            {currentCalendarId === 'google' ? (
              // 🔑 구글 캘린더 전용 입력 양식 (제목/종일/기간/시간/위치/설명 — 구글 캘린더 UI와 동일한 구성)
              <form onSubmit={handleAddEventSubmit} className="space-y-4 text-sm">
                <div>
                  <input
                    type="text" required placeholder="제목 추가" value={newEvent.title}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full p-2 border-b-2 border-[#E9E9E6] text-base font-medium focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      checked={!newEvent.startTime}
                      onChange={(e) => {
                        if (e.target.checked) setNewEvent(prev => ({ ...prev, startTime: '', endTime: '' }));
                        else setNewEvent(prev => ({ ...prev, startTime: '09:00', endTime: '10:00' }));
                      }}
                      className="w-3.5 h-3.5 accent-blue-600"
                    />
                    종일
                  </label>

                  {/* 🔑 구글 캘린더 색상 선택 */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAddColorPickerOpen(!isAddColorPickerOpen)}
                      className="flex items-center gap-1 px-2 py-1 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] hover:bg-gray-100"
                      title={(GOOGLE_COLOR_OPTIONS.find(o => o.id === (newEvent.colorId || '')) || GOOGLE_COLOR_OPTIONS[0]).label}
                    >
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: (GOOGLE_COLOR_OPTIONS.find(o => o.id === (newEvent.colorId || '')) || GOOGLE_COLOR_OPTIONS[0]).hex }}
                      />
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    </button>
                    {isAddColorPickerOpen && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-[#E9E9E6] rounded-lg shadow-xl z-50 p-3 w-56">
                        <div className="grid grid-cols-6 gap-2">
                          {GOOGLE_COLOR_OPTIONS.filter(o => o.id !== '').map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              title={opt.label}
                              onClick={() => { setNewEvent(prev => ({ ...prev, colorId: opt.id })); setIsAddColorPickerOpen(false); }}
                              className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${newEvent.colorId === opt.id ? 'ring-2 ring-offset-1 ring-gray-500' : ''}`}
                              style={{ backgroundColor: opt.hex }}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => { setNewEvent(prev => ({ ...prev, colorId: '' })); setIsAddColorPickerOpen(false); }}
                          className="w-full mt-3 pt-2.5 border-t border-[#E9E9E6] flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800"
                        >
                          {!newEvent.colorId && <Check className="w-3.5 h-3.5 text-blue-600" />} 기본
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5 text-rose-500" /> 시작일 *</label>
                    <input type="date" required value={newEvent.startDate} onChange={(e) => setNewEvent(prev => ({ ...prev, startDate: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" />
                    {newEvent.startTime && (
                      <input type="time" value={newEvent.startTime} onChange={(e) => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))} className="w-full mt-1.5 p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 text-sky-500" /> 종료일</label>
                    <input type="date" value={newEvent.endDate} onChange={(e) => setNewEvent(prev => ({ ...prev, endDate: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" />
                    {newEvent.startTime && (
                      <input type="time" value={newEvent.endTime} onChange={(e) => setNewEvent(prev => ({ ...prev, endTime: e.target.value }))} className="w-full mt-1.5 p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" />
                    )}
                  </div>
                </div>

                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" /> 위치</label><input type="text" placeholder="위치 추가" value={newEvent.location} onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-gray-400" /> 설명</label><textarea rows={3} placeholder="설명 추가" value={newEvent.memo} onChange={(e) => setNewEvent(prev => ({ ...prev, memo: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>

                <div className="flex gap-2 pt-3 border-t border-[#E9E9E6]">
                  <button type="button" onClick={handleCloseAddModal} className="flex-1 py-2 border border-[#E9E9E6] text-gray-600 rounded-md hover:bg-gray-100 font-medium text-xs">취소</button>
                  <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-xs">저장</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddEventSubmit} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">일정 제목 *</label>
                  <input
                    type="text" required placeholder="예: 2학기 교내 자율 연수 협의회" value={newEvent.title}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none focus:ring-1 focus:ring-purple-400"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col relative">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Palette className="w-3.5 h-3.5 text-gray-400" /> 카테고리 선택 *</label>
                    <button type="button" onClick={() => setIsAddCatDropdownOpen(!isAddCatDropdownOpen)} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] flex items-center justify-between hover:bg-gray-50 text-left">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${(displayCategories[newEvent.category] || NOTION_PALETTES.gray).bg} border ${(displayCategories[newEvent.category] || NOTION_PALETTES.gray).border}`}></span>
                        <span className="font-semibold text-xs">{newEvent.category}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                    {isAddCatDropdownOpen && (
                      <div className="absolute left-0 right-0 top-13.5 bg-white border border-[#E9E9E6] rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        {categoryOrder.map((catName) => {
                          const styling = categories[catName];
                          if (!styling) return null;
                          return (
                            <button key={catName} type="button" onClick={() => { setNewEvent(prev => ({ ...prev, category: catName })); setIsAddCatDropdownOpen(false); }} className="w-full px-3 py-2 text-left hover:bg-[#F7F7F5] flex items-center gap-2 border-b border-gray-50 last:border-0">
                              <span className={`w-3 h-3 rounded-full ${styling.bg} border ${styling.border} shrink-0`}></span>
                              <span className={`${styling.text} font-semibold text-xs rounded px-1.5 py-0.5 ${styling.bg}`}>{catName}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><User className="w-3.5 h-3.5 text-gray-400" /> 담당 교사</label><input type="text" placeholder="공란 입력 시 익명 처리" value={newEvent.manager} onChange={(e) => setNewEvent(prev => ({ ...prev, manager: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                  <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5 text-rose-500" /> 시작일 *</label><input type="date" required value={newEvent.startDate} onChange={(e) => setNewEvent(prev => ({ ...prev, startDate: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                  <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 text-sky-500" /> 종료일</label><input type="date" value={newEvent.endDate} onChange={(e) => setNewEvent(prev => ({ ...prev, endDate: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                  <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400" /> 시작 시간</label><input type="time" value={newEvent.startTime} onChange={(e) => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                  <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400" /> 종료 시간</label><input type="time" value={newEvent.endTime} onChange={(e) => setNewEvent(prev => ({ ...prev, endTime: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                  <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" /> 장소</label><input type="text" placeholder="예: 2학년 무한상상실" value={newEvent.location} onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                  <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5 text-gray-400" /> 신청인원 / 대상</label><input type="text" placeholder="예: 학년부 교사 전원" value={newEvent.applyCount} onChange={(e) => setNewEvent(prev => ({ ...prev, applyCount: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                </div>

                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Link className="w-3.5 h-3.5 text-gray-400" /> 신청방법 / 링크</label><input type="text" placeholder="예: 리로스쿨 공지사항 등" value={newEvent.applyMethod} onChange={(e) => setNewEvent(prev => ({ ...prev, applyMethod: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-gray-400" /> 상세 메모</label><textarea rows={3} placeholder="추가 세부 사항을 기재해 주세요." value={newEvent.memo} onChange={(e) => setNewEvent(prev => ({ ...prev, memo: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>

                <div className="flex gap-2 pt-3 border-t border-[#E9E9E6]">
                  <button type="button" onClick={handleCloseAddModal} className="flex-1 py-2 border border-[#E9E9E6] text-gray-600 rounded-md hover:bg-gray-100 font-medium text-xs">취소</button>
                  <button type="submit" className="flex-1 py-2 bg-[#37352F] hover:bg-black text-white rounded-md font-medium text-xs">{editingProposalId ? '수정 완료' : '캘린더에 게시'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Detail & Action Management Modal */}
      {isDetailModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E9E9E6] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E9E9E6] pb-3">
              {isEditing ? (
                <h3 className="text-base font-bold text-[#37352F] flex items-center gap-2"><Edit3 className="w-5 h-5 text-purple-700" /> 일정 수정</h3>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${(categories[selectedEvent.category] || NOTION_PALETTES.gray).bg} ${(categories[selectedEvent.category] || NOTION_PALETTES.gray).text}`}>{selectedEvent.category}</span>
                  <span className="text-xs text-gray-400 font-medium">{selectedEvent.startDate} {selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate && `~ ${selectedEvent.endDate}`}</span>
                </div>
              )}
              <button onClick={() => { setIsDetailModalOpen(false); setSelectedEvent(null); setIsEditing(false); }} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>

            {isEditing ? (
              currentCalendarId === 'google' ? (
                // 🔑 구글 캘린더 전용 수정 양식
                <div className="space-y-4 text-sm">
                  <div>
                    <input
                      type="text" required value={editEventForm.title}
                      onChange={(e) => setEditEventForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full p-2 border-b-2 border-[#E9E9E6] text-base font-medium focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer w-fit">
                      <input
                        type="checkbox"
                        checked={!editEventForm.startTime}
                        onChange={(e) => {
                          if (e.target.checked) setEditEventForm(prev => ({ ...prev, startTime: '', endTime: '' }));
                          else setEditEventForm(prev => ({ ...prev, startTime: '09:00', endTime: '10:00' }));
                        }}
                        className="w-3.5 h-3.5 accent-blue-600"
                      />
                      종일
                    </label>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsEditColorPickerOpen(!isEditColorPickerOpen)}
                        className="flex items-center gap-1 px-2 py-1 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] hover:bg-gray-100"
                        title={(GOOGLE_COLOR_OPTIONS.find(o => o.id === (editEventForm.colorId || '')) || GOOGLE_COLOR_OPTIONS[0]).label}
                      >
                        <span
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: (GOOGLE_COLOR_OPTIONS.find(o => o.id === (editEventForm.colorId || '')) || GOOGLE_COLOR_OPTIONS[0]).hex }}
                        />
                        <ChevronDown className="w-3 h-3 text-gray-400" />
                      </button>
                      {isEditColorPickerOpen && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-[#E9E9E6] rounded-lg shadow-xl z-50 p-3 w-56">
                          <div className="grid grid-cols-6 gap-2">
                            {GOOGLE_COLOR_OPTIONS.filter(o => o.id !== '').map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                title={opt.label}
                                onClick={() => { setEditEventForm(prev => ({ ...prev, colorId: opt.id })); setIsEditColorPickerOpen(false); }}
                                className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${editEventForm.colorId === opt.id ? 'ring-2 ring-offset-1 ring-gray-500' : ''}`}
                                style={{ backgroundColor: opt.hex }}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => { setEditEventForm(prev => ({ ...prev, colorId: '' })); setIsEditColorPickerOpen(false); }}
                            className="w-full mt-3 pt-2.5 border-t border-[#E9E9E6] flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800"
                          >
                            {!editEventForm.colorId && <Check className="w-3.5 h-3.5 text-blue-600" />} 기본
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5 text-rose-500" /> 시작일 *</label>
                      <input type="date" required value={editEventForm.startDate} onChange={(e) => setEditEventForm(prev => ({ ...prev, startDate: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" />
                      {editEventForm.startTime && (
                        <input type="time" value={editEventForm.startTime} onChange={(e) => setEditEventForm(prev => ({ ...prev, startTime: e.target.value }))} className="w-full mt-1.5 p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 text-sky-500" /> 종료일</label>
                      <input type="date" value={editEventForm.endDate} onChange={(e) => setEditEventForm(prev => ({ ...prev, endDate: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" />
                      {editEventForm.startTime && (
                        <input type="time" value={editEventForm.endTime} onChange={(e) => setEditEventForm(prev => ({ ...prev, endTime: e.target.value }))} className="w-full mt-1.5 p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" />
                      )}
                    </div>
                  </div>

                  <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" /> 위치</label><input type="text" placeholder="위치 추가" value={editEventForm.location} onChange={(e) => setEditEventForm(prev => ({ ...prev, location: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                  <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-gray-400" /> 설명</label><textarea rows={3} placeholder="설명 추가" value={editEventForm.memo} onChange={(e) => setEditEventForm(prev => ({ ...prev, memo: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>

                  <div className="flex gap-2 pt-3 border-t border-[#E9E9E6]">
                    <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-2 border border-[#E9E9E6] text-gray-600 rounded-md hover:bg-gray-100 font-medium text-xs">취소</button>
                    <button type="button" onClick={handleUpdateEvent} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-xs">저장</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">일정 제목 *</label>
                    <input
                      type="text" required value={editEventForm.title}
                      onChange={(e) => setEditEventForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col relative">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Palette className="w-3.5 h-3.5 text-gray-400" /> 카테고리 선택 *</label>
                      <button type="button" onClick={() => setIsEditCatDropdownOpen(!isEditCatDropdownOpen)} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] flex items-center justify-between hover:bg-gray-50 text-left">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${(categories[editEventForm.category] || NOTION_PALETTES.gray).bg} border ${(categories[editEventForm.category] || NOTION_PALETTES.gray).border}`}></span>
                          <span className="font-semibold text-xs">{editEventForm.category}</span>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </button>
                      {isEditCatDropdownOpen && (
                        <div className="absolute left-0 right-0 top-13.5 bg-white border border-[#E9E9E6] rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                          {categoryOrder.map((catName) => {
                            const styling = categories[catName];
                            if (!styling) return null;
                            return (
                              <button key={catName} type="button" onClick={() => { setEditEventForm(prev => ({ ...prev, category: catName })); setIsEditCatDropdownOpen(false); }} className="w-full px-3 py-2 text-left hover:bg-[#F7F7F5] flex items-center gap-2 border-b border-gray-50 last:border-0">
                                <span className={`w-3 h-3 rounded-full ${styling.bg} border ${styling.border} shrink-0`}></span>
                                <span className={`${styling.text} font-semibold text-xs rounded px-1.5 py-0.5 ${styling.bg}`}>{catName}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><User className="w-3.5 h-3.5 text-gray-400" /> 담당 교사</label><input type="text" value={editEventForm.manager} onChange={(e) => setEditEventForm(prev => ({ ...prev, manager: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                    <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5 text-rose-500" /> 시작일 *</label><input type="date" required value={editEventForm.startDate} onChange={(e) => setEditEventForm(prev => ({ ...prev, startDate: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                    <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 text-sky-500" /> 종료일</label><input type="date" value={editEventForm.endDate} onChange={(e) => setEditEventForm(prev => ({ ...prev, endDate: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                    <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400" /> 시작 시간</label><input type="time" value={editEventForm.startTime} onChange={(e) => setEditEventForm(prev => ({ ...prev, startTime: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                    <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400" /> 종료 시간</label><input type="time" value={editEventForm.endTime} onChange={(e) => setEditEventForm(prev => ({ ...prev, endTime: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                    <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" /> 장소</label><input type="text" value={editEventForm.location} onChange={(e) => setEditEventForm(prev => ({ ...prev, location: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                    <div className="flex flex-col"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5 text-gray-400" /> 신청인원 / 대상</label><input type="text" value={editEventForm.applyCount} onChange={(e) => setEditEventForm(prev => ({ ...prev, applyCount: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                  </div>

                  <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Link className="w-3.5 h-3.5 text-gray-400" /> 신청방법 / 링크</label><input type="text" value={editEventForm.applyMethod} onChange={(e) => setEditEventForm(prev => ({ ...prev, applyMethod: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                  <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-gray-400" /> 상세 메모</label><textarea rows={3} value={editEventForm.memo} onChange={(e) => setEditEventForm(prev => ({ ...prev, memo: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>

                  <div className="flex gap-2 pt-3 border-t border-[#E9E9E6]">
                    <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-2 border border-[#E9E9E6] text-gray-600 rounded-md hover:bg-gray-100 font-medium text-xs">취소</button>
                    <button type="button" onClick={handleUpdateEvent} className="flex-1 py-2 bg-[#37352F] hover:bg-black text-white rounded-md font-medium text-xs">수정 완료</button>
                  </div>
                </div>
              )
            ) : (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-extrabold text-[#37352F] break-all">{selectedEvent.title}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600 bg-[#F7F7F5] p-4 rounded-lg border border-[#E9E9E6]">
                    <div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400 shrink-0" /> <span className="font-semibold text-gray-400 w-16">담당 교사</span> <span className="text-[#37352F] font-medium">{selectedEvent.manager || '-'}</span></div>
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400 shrink-0" /> <span className="font-semibold text-gray-400 w-16">시간 구성</span> <span className="text-[#37352F] font-medium">{selectedEvent.startTime || selectedEvent.endTime ? `${selectedEvent.startTime || '미정'} ~ ${selectedEvent.endTime || '미정'}` : '-'}</span></div>
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400 shrink-0" /> <span className="font-semibold text-gray-400 w-16">장소</span> <span className="text-[#37352F] font-medium">{selectedEvent.location || '-'}</span></div>
                    <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400 shrink-0" /> <span className="font-semibold text-gray-400 w-16">인원 / 대상</span> <span className="text-[#37352F] font-medium">{selectedEvent.applyCount || '-'}</span></div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase">상세 메모</p>
                    <div className="bg-white border border-[#E9E9E6] p-3 rounded-md text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto break-all">{selectedEvent.memo || '등록된 내용이 없습니다.'}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-[#E9E9E6] pt-4">
                  <div className="text-[11px] text-gray-400">공유형 모드 라이브 상태입니다.</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditEventForm({
                          id: selectedEvent.id,
                          title: selectedEvent.title || '',
                          category: selectedEvent.category || (Object.keys(categories)[0] || '기타'),
                          manager: selectedEvent.manager || '',
                          startDate: selectedEvent.startDate || '',
                          endDate: selectedEvent.endDate || '',
                          startTime: selectedEvent.startTime || '',
                          endTime: selectedEvent.endTime || '',
                          location: selectedEvent.location || '',
                          applyMethod: selectedEvent.applyMethod || '',
                          applyCount: selectedEvent.applyCount || '',
                          memo: selectedEvent.memo || '',
                          colorId: selectedEvent.colorId || ''
                        });
                        setIsEditing(true);
                      }}
                      className="flex items-center gap-1 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-purple-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> 수정
                    </button>
                    <button onClick={() => handleDeleteEvent(selectedEvent.id)} className="flex items-center gap-1 border border-rose-200 text-rose-600 px-3 py-1.5 rounded-md text-xs font-semibold"><Trash2 className="w-3.5 h-3.5" /> 삭제</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 설정 모달 */}
      {isCategoryManageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E9E9E6] rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E9E9E6] pb-3">
              <h3 className="text-base font-bold text-[#37352F] flex items-center gap-2"><Settings className="w-5 h-5 text-gray-600" /> 교무실 통합 제어 설정</h3>
              <button onClick={() => setIsCategoryManageOpen(false)} className="p-1 hover:bg-gray-100 rounded" style={{ WebkitAppRegion: 'no-drag' }}><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-teal-50/50 border border-teal-100 p-2.5 rounded-lg">
              <div className="flex items-center gap-1.5">
                <input
                  type="text" placeholder="담임반" value={myClassNumInput}
                  onChange={(e) => setMyClassNumInput(e.target.value)}
                  title="담임반 (예: 3) — 저장 시 시간표/성적분석에서 자동 선택"
                  className="w-16 p-1.5 border border-teal-200 rounded text-xs bg-white focus:outline-none shrink-0"
                />
                <input
                  type="text" placeholder="이름" value={myTeacherNameInput}
                  onChange={(e) => setMyTeacherNameInput(e.target.value)}
                  title="본인 이름 — 저장 시 교사별 시간표에서 자동 선택"
                  className="flex-1 min-w-0 p-1.5 border border-teal-200 rounded text-xs bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSaveMyInfo(myClassNumInput.trim(), myTeacherNameInput.trim())}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded shrink-0"
                >
                  저장
                </button>
              </div>
            </div>

            <div className="bg-amber-50/50 border border-amber-100 p-3.5 rounded-lg space-y-2">
              <p className="text-xs font-bold text-amber-900">야자감독 구글시트 자동 동기화</p>

              {isEditingSheetSyncId ? (
                <div className="flex gap-2">
                  <input
                    type="text" placeholder="스프레드시트 ID" value={sheetSyncIdInput}
                    onChange={(e) => setSheetSyncIdInput(e.target.value)}
                    className="flex-1 min-w-0 p-2 border border-amber-200 rounded text-xs bg-white focus:outline-none"
                  />
                  <button type="button" onClick={handleSaveSheetSyncConfig} className="px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded shrink-0">저장</button>
                  {sheetSyncConfig && (
                    <button type="button" onClick={() => { setSheetSyncIdInput(sheetSyncConfig.spreadsheetId || ''); setIsEditingSheetSyncId(false); }} className="px-2 py-2 border border-amber-300 text-amber-700 text-xs font-bold rounded shrink-0">취소</button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white border border-amber-200 rounded px-2.5 py-2">
                  <span className="flex-1 min-w-0 text-xs font-mono text-gray-600 truncate">
                    {sheetSyncConfig?.spreadsheetId || '등록된 스프레드시트가 없습니다.'}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSheetSyncIdInput(sheetSyncConfig?.spreadsheetId || ''); setIsEditingSheetSyncId(true); }}
                    className="text-[11px] font-bold text-amber-700 hover:bg-amber-100 px-2 py-1 rounded shrink-0"
                  >
                    {sheetSyncConfig ? '수정' : '등록'}
                  </button>
                </div>
              )}

              {sheetSyncConfig && !isEditingSheetSyncId && (
                <button
                  type="button"
                  onClick={() => handleSyncFromGoogleSheet(sheetSyncConfig, year, month)}
                  disabled={isSyncingSheet}
                  className="w-full py-1.5 border border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-50 text-xs font-bold rounded"
                >
                  {isSyncingSheet ? '동기화 중...' : '지금 새로고침'}
                </button>
              )}
            </div>

            <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-lg space-y-3">
              <p className="text-xs font-bold text-blue-900">개인 구글 캘린더 연동</p>
              {googleAccountEmail ? (
                <div className="flex items-center justify-between bg-white border border-blue-200 rounded-md px-3 py-2">
                  <span className="text-xs font-semibold text-gray-700 truncate">{googleAccountEmail}</span>
                  <button type="button" onClick={handleGoogleDisconnect} className="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded shrink-0">연동 해제</button>
                </div>
              ) : (
                <button type="button" onClick={handleGoogleConnect} disabled={isGoogleConnecting} className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded text-xs font-bold">
                  {isGoogleConnecting ? '연결 중...' : '구글 계정 연결하기'}
                </button>
              )}
              <p className="text-[10px] text-gray-400 leading-snug">연동한 구글 캘린더는 본인만 볼 수 있으며 다른 선생님과 공유되지 않습니다.</p>
            </div>

            <div className="bg-purple-50/50 border border-purple-100 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsGeminiSectionOpen(!isGeminiSectionOpen)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <p className="text-xs font-bold text-purple-900">Gemini AI 비서 API 키 설정</p>
                <ChevronDown className={`w-4 h-4 text-purple-700 transition-transform ${isGeminiSectionOpen ? 'rotate-180' : ''}`} />
              </button>
              {isGeminiSectionOpen && (
                <div className="p-3.5 pt-0 space-y-3">
                  <input type="password" placeholder="AI_STUDIO_API_KEY 입력" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} className="w-full p-2 border border-purple-200 rounded text-xs bg-white focus:outline-none" />
                  <div className="flex gap-2">
                    <button type="button" onClick={handleSaveApiKeyToLocal} className="flex-1 py-1.5 border border-purple-300 text-purple-700 text-xs font-bold rounded">내PC에만 임시등록</button>
                    <button type="button" onClick={handleShareApiKeyToFirestore} className="flex-1 py-1.5 bg-purple-700 text-white text-xs font-bold rounded">전체교사 공유저장</button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#F7F7F5] p-3.5 rounded-lg border border-[#E9E9E6] space-y-3">
              <p className="text-xs font-bold text-gray-600">
                {editingCategoryName ? `'${editingCategoryName}' 카테고리 수정` : '새 카테고리 추가'}
              </p>
              <input type="text" placeholder="카테고리 명칭 입력" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="w-full p-2 border border-[#E9E9E6] rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-400" />

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">색상 선택</p>
                <div className="flex items-center flex-wrap gap-2.5">
                  {Object.entries(NOTION_PALETTES).map(([paletteKey, styling]) => (
                    <button
                      key={paletteKey} type="button" title={styling.label} onClick={() => setSelectedPaletteKey(paletteKey)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${styling.bg} ${selectedPaletteKey === paletteKey ? 'border-[#37352F] scale-110 shadow-sm' : 'border-white hover:scale-105'}`}
                    ></button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCategoryShowAsBadge}
                  onChange={(e) => setNewCategoryShowAsBadge(e.target.checked)}
                  className="w-3.5 h-3.5 accent-purple-600"
                />
                날짜 숫자 옆에 작은 배지로 표시 (일정 목록에는 안 보임)
              </label>

              <div className="flex gap-2">
                {editingCategoryName && (
                  <button type="button" onClick={handleCancelCategoryEdit} className="flex-1 py-2 border border-[#E9E9E6] text-gray-600 rounded text-xs font-bold hover:bg-gray-100">취소</button>
                )}
                <button onClick={handleAddCategorySubmit} className={`flex-1 py-2 text-white rounded text-xs font-bold ${editingCategoryName ? 'bg-purple-700 hover:bg-purple-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}>
                  {editingCategoryName ? '수정 완료' : '+ 등록'}
                </button>
              </div>

              <div className="pt-3 border-t border-[#E9E9E6] space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">저장된 카테고리 ({Object.keys(categories).length}개) · 드래그로 순서 변경</p>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {categoryOrder.map((catName) => {
                    const styling = categories[catName];
                    if (!styling) return null;
                    const isHovered = dragOverCategoryName === catName;
                    return (
                      <div 
                        key={catName}
                        draggable="true"
                        onDragStart={(e) => handleCategoryDragStart(e, catName)}
                        onDragEnd={handleCategoryDragEnd}
                        onDragOver={handleCategoryDragOver}
                        onDragEnter={(e) => handleCategoryDragEnter(e, catName)}
                        onDrop={handleCategoryDrop}
                        onClick={() => handleSelectCategoryToEdit(catName)}
                        className={`flex items-center justify-between bg-white border rounded-md px-2.5 py-1.5 cursor-pointer
                          transition-all duration-300 transform origin-center
                          ${isHovered ? 'scale-[1.03] -translate-y-0.5 shadow-md z-20' : 'scale-100 translate-y-0'}
                          active:cursor-grabbing
                          ${editingCategoryName === catName ? 'border-purple-400 ring-1 ring-purple-200' : 'border-[#E9E9E6] hover:border-purple-200'}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Menu className="w-3.5 h-3.5 text-gray-300 shrink-0 cursor-grab" />
                          <span className={`w-3 h-3 rounded-full ${styling.bg} border ${styling.border} shrink-0`}></span>
                          <span className="text-xs font-semibold text-gray-700 truncate">{catName}</span>
                          {styling.showAsBadge && <span className="text-[9px] font-bold text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded shrink-0">배지</span>}
                        </div>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); handleDeleteCategory(catName); }} 
                          className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <button onClick={() => setIsCategoryManageOpen(false)} className="w-full py-2 bg-gray-100 text-gray-700 rounded text-xs font-bold">설정 닫기</button>
          </div>
        </div>
      )}

      {/* 오늘의 한마디 수정 모달 */}
      {isNoticeEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E9E9E6] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E9E9E6] pb-3">
              <h3 className="text-base font-bold text-[#37352F] flex items-center gap-2"><MessageSquare className="w-5 h-5 text-purple-700" /> 오늘의 한마디 등록</h3>
              <button onClick={() => setIsNoticeEditOpen(false)} className="p-1 hover:bg-gray-100 rounded transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3.5 max-h-[55vh] overflow-y-auto pr-1">
              {noticeFormList.map((notice, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center bg-[#F7F7F5]/50 border border-gray-100 p-3 rounded-lg relative">
                  <div className="md:col-span-3 flex flex-col">
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">오늘의 한마디({idx + 1})</label>
                    <input type="text" placeholder="칠판에 띄울 안내 핵심 내용을 기입하세요." value={notice.text || ''} onChange={(e) => { const copy = [...noticeFormList]; copy[idx].text = e.target.value; setNoticeFormList(copy); }} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-white text-xs font-semibold focus:outline-none" />
                  </div>
                  <div className="md:col-span-1 flex items-end gap-1.5">
                    <div className="flex-1 flex flex-col">
                      <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">작성자</label>
                      <input type="text" placeholder="예: 홍길동" value={notice.author || ''} onChange={(e) => { const copy = [...noticeFormList]; copy[idx].author = e.target.value; setNoticeFormList(copy); }} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-white text-xs focus:outline-none" />
                    </div>
                    <button type="button" disabled={noticeFormList.length <= 1} onClick={() => setNoticeFormList(noticeFormList.filter((_, i) => i !== idx))} className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-transparent hover:border-rose-100 disabled:opacity-40 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setNoticeFormList([...noticeFormList, { text: '', author: '' }])} className="w-full py-2.5 border border-dashed border-purple-200 text-purple-700 bg-purple-50/30 hover:bg-purple-50 transition-all rounded-lg text-xs font-black">+ 오늘의 한마디 추가</button>
            <div className="flex gap-3 pt-3 border-t border-[#E9E9E6]">
              <button onClick={() => setIsNoticeEditOpen(false)} className="flex-1 py-2 border border-[#E9E9E6] text-gray-600 rounded-md hover:bg-gray-100 font-medium text-xs">취소</button>
              <button onClick={handleUpdateNotice} className="flex-1 py-2 bg-[#37352F] hover:bg-black text-white rounded-md font-medium text-xs">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 디데이 설정 모달 */}
      {isDdayEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E9E9E6] rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-[#E9E9E6] pb-3">
              <h3 className="text-base font-bold text-[#37352F] flex items-center gap-2"><Pin className="w-5 h-5 text-rose-500 fill-current" /> D-Day 설정</h3>
              <button onClick={() => setIsDdayEditOpen(false)} className="p-1 hover:bg-gray-100 rounded transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4 text-sm">
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">이벤트 이름 *</label><input type="text" placeholder="예: 1차 지필평가, 수능" value={ddayForm.label} onChange={(e) => setDdayForm({...ddayForm, label: e.target.value})} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none focus:ring-1 focus:ring-rose-400 font-semibold" /></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">이벤트 날짜 *</label><input type="date" value={ddayForm.date} onChange={(e) => setDdayForm({...ddayForm, date: e.target.value})} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none focus:ring-1 focus:ring-rose-400 text-xs font-medium" /></div>
            </div>
            <div className="flex flex-col gap-2 pt-3 border-t border-[#E9E9E6]">
              <div className="flex gap-2">
                <button onClick={() => setIsDdayEditOpen(false)} className="flex-1 py-2 border border-[#E9E9E6] text-gray-600 rounded-md hover:bg-gray-100 font-medium text-xs">취소</button>
                <button onClick={handleUpdateDday} className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-medium text-xs shadow-xs">저장</button>
              </div>
              {todayNotice.ddayTarget && <button type="button" onClick={handleClearDday} className="w-full py-1.5 border border-dashed border-gray-300 text-gray-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50/50 transition-all rounded text-xs font-bold flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5" /> <span>D-Day 비우기 (설정 없음으로 초기화)</span></button>}
            </div>
          </div>
        </div>
      )}

      {/* 🔑 [신규] 학생 성적 대시보드 (전체화면 모달) */}
      {isGradesDashboardOpen && <StudentGradesDashboard onClose={handleCloseGradesDashboard} myClassNum={myClassNum} />}

      </div>
  );
}