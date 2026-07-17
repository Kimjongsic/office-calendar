import React, { useState, useEffect, useMemo } from 'react';
import { db, initAnonymousAuth } from './firebase'; // 3단계 파이어베이스 인스턴스 사용
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
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
  Utensils
} from 'lucide-react';

const NOTION_PALETTES = {
  red: { bg: 'bg-[#FFE2DD]', text: 'text-[#5D0F00]', border: 'border-[#FFE2DD]', color: '#FFE2DD', label: '연한 빨강' },
  blue: { bg: 'bg-[#DDEBF1]', text: 'text-[#0C3446]', border: 'border-[#DDEBF1]', color: '#DDEBF1', label: '연한 파랑' },
  yellow: { bg: 'bg-[#FDECC8]', text: 'text-[#5C3B00]', border: 'border-[#FDECC8]', color: '#FDECC8', label: '연한 노랑' },
  green: { bg: 'bg-[#DDEDEA]', text: 'text-[#1C3D27]', border: 'border-[#DDEDEA]', color: '#DDEDEA', label: '연한 녹색' },
  purple: { bg: 'bg-[#EAE4F2]', text: 'text-[#461146]', border: 'border-[#EAE4F2]', color: '#EAE4F2', label: '연한 보라' },
  orange: { bg: 'bg-[#FAE3D9]', text: 'text-[#632000]', border: 'border-[#FAE3D9]', color: '#FAE3D9', label: '연한 주황' },
  gray: { bg: 'bg-[#E3E2E0]', text: 'text-[#37352F]', border: 'border-[#E3E2E0]', color: '#E3E2E0', label: '연한 회색' }
};

export default function App() {
  const appId = 'notion-school-calendar';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [events, setEvents] = useState([]);
  const [syncStatus, setSyncStatus] = useState('initializing');

  const [categories, setCategories] = useState({
    '교무회의': NOTION_PALETTES.red,
    '학사일정': NOTION_PALETTES.blue,
    '연수/출장': NOTION_PALETTES.yellow,
    '행사/축제': NOTION_PALETTES.green,
    '급식/보건': NOTION_PALETTES.purple,
    '공동업무': NOTION_PALETTES.orange,
    '기타': NOTION_PALETTES.gray
  });

  /* [수정] 오늘의 한마디 각 항목에 작성자(author)를 함께 저장하도록 words 구조를
     문자열 배열 -> { text, author } 객체 배열로 확장 */
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

  const [selectedEvent, setSelectedEvent] = useState(null);

  /* [중앙 공유형 키 시스템 구축] */
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');

  /* 11대 일정 양식 폼 */
  const [newEvent, setNewEvent] = useState({
    title: '',
    category: '교무회의',
    manager: localStorage.getItem('school_calendar_manager') || '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    location: '',
    applyMethod: '',
    applyCount: '',
    memo: ''
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editEventForm, setEditEventForm] = useState({
    id: '',
    title: '',
    category: '교무회의',
    manager: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    location: '',
    applyMethod: '',
    applyCount: '',
    memo: ''
  });

  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedPaletteKey, setSelectedPaletteKey] = useState('red');
  /* [수정] 오늘의 한마디 편집 폼 리스트도 { text, author } 객체 배열로 변경 */
  const [noticeFormList, setNoticeFormList] = useState([{ text: '', author: '' }]);
  const [ddayForm, setDdayForm] = useState({ label: '', date: '' });

  // 메신저 일정 다중 AI 분석 제안 리스트
  const [messengerInput, setMessengerInput] = useState('');
  const [parsedProposals, setParsedProposals] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  /* AI 카드 내부 카테고리 변경 상태 관리 임시 상태 */
  const [activeProposalCatDropdownId, setActiveProposalCatDropdownId] = useState(null);

  /* 드래그 시작 대상 일정 아이디 보관 상태 */
  const [draggedEventId, setDraggedEventId] = useState(null);

  /* 창 제어 기능 확장 상태관리 */
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isMoveLocked, setIsMovelocked] = useState(false);
  const [opacityValue, setOpacityValue] = useState(1.0);
  const [isOpacityDropdownOpen, setIsOpacityDropdownOpen] = useState(false);

  /* 나이스 오픈 API 명세 고정 상수 */
  const neisConfig = {
    key: 'edb57391f5a14ac7bf15f31e4615c7c1',
    officeCode: 'P10',
    schoolCode: '8321082'
  };
  const [meals, setMeals] = useState({});

  /* 하단 인라인 패널 개방 유무 상태 제어반 (null: 닫힘, 'meal': 급식, 'ai': AI분석) */
  /* [수정] 기존에는 이 상태가 "우측 사이드바" 표시 여부를 제어했지만, 이제는
     디데이 박스 하단에 표시되는 "인라인 정보 패널"의 표시 여부를 제어합니다. */
  const [activeSidePanel, setActiveSidePanel] = useState(null);

  /* 상단 헤더 컴포넌트 렌더링에 필요한 날짜 관련 상수 */
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'info' });
    }, 3000);
  };

  const formatDateString = (y, m, d) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  useEffect(() => {
    const activeKeys = Object.keys(categories);
    if (activeKeys.length > 0) {
      if (!activeKeys.includes(newEvent.category)) {
        setNewEvent(prev => ({ ...prev, category: activeKeys[0] }));
      }
      if (isEditing && !activeKeys.includes(editEventForm.category)) {
        setEditEventForm(prev => ({ ...prev, category: activeKeys[0] }));
      }
    }
  }, [categories, isEditing]);

  useEffect(() => {
    const initFirebaseConnection = async () => {
      try {
        setSyncStatus('connecting');
        await initAnonymousAuth();
        setSyncStatus('connected');
      } catch (err) {
        console.error("Firebase Auth Offline fallback.", err);
        setSyncStatus('local');
        const savedEvents = localStorage.getItem('local_school_events');
        if (savedEvents) {
          setEvents(JSON.parse(savedEvents));
        } else {
          const defaultEvents = [
            {
              id: '1',
              title: '2학기 교육과정 설명회',
              category: '교무회의',
              manager: '김보람',
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date().toISOString().split('T')[0],
              startTime: '14:00',
              endTime: '16:00',
              location: '체육관',
              applyMethod: '가정통신문 회신',
              applyCount: '전체 교직원 및 학부모',
              memo: '체육관 무대 세팅 및 인쇄물 사전 검토 필요',
              sourceOrder: 0
            }
          ];
          setEvents(defaultEvents);
          localStorage.setItem('local_school_events', JSON.stringify(defaultEvents));
        }
      }
    };
    initFirebaseConnection();
  }, []);

  useEffect(() => {
    if (syncStatus !== 'connected' || !db) return;
    const eventsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'events');
    const unsubscribe = onSnapshot(eventsCollection, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      setEvents(items);
    }, (error) => {
      console.error("Firestore loading error:", error);
      setSyncStatus('local');
    });
    return () => unsubscribe();
  }, [syncStatus]);

  useEffect(() => {
    if (syncStatus !== 'connected' || !db) return;
    const categoryDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'categories', 'active_list');
    const unsubscribe = onSnapshot(categoryDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setCategories(snapshot.data());
      } else {
        setDoc(categoryDocRef, categories);
      }
    });
    return () => unsubscribe();
  }, [syncStatus]);

  useEffect(() => {
    if (syncStatus !== 'connected' || !db) return;
    const noticeDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'notices', 'board');
    const unsubscribe = onSnapshot(noticeDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const rawData = snapshot.data();
        let words = [];
        /* [수정] 과거 버전(문자열 배열)으로 저장된 데이터도 { text, author } 객체로
           안전하게 변환하여 하위 호환성을 유지 */
        if (rawData.words && Array.isArray(rawData.words)) {
          words = rawData.words.map(w => (typeof w === 'string' ? { text: w, author: '' } : { text: w.text || '', author: w.author || '' }));
        } else if (rawData.word) {
          words = [{ text: rawData.word, author: '' }];
        } else {
          words = [{ text: '', author: '' }];
        }
        setTodayNotice({
          ...rawData,
          words: words,
          ddayLabel: rawData.ddayLabel || '',
          ddayTarget: rawData.ddayTarget || ''
        });
      } else {
        setDoc(noticeDocRef, todayNotice);
      }
    });
    return () => unsubscribe();
  }, [syncStatus]);

  useEffect(() => {
    if (syncStatus !== 'connected' || !db) {
      const localKey = localStorage.getItem('user_gemini_api_key');
      if (localKey) {
        setGeminiApiKey(localKey);
        setTempApiKey(localKey);
      }
      return;
    }

    const geminiDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'gemini');
    const unsubscribe = onSnapshot(geminiDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const sharedKey = snapshot.data().apiKey || '';
        if (sharedKey) {
          setGeminiApiKey(sharedKey);
          setTempApiKey(sharedKey);
        }
      } else {
        const localKey = localStorage.getItem('user_gemini_api_key');
        if (localKey) {
          setGeminiApiKey(localKey);
          setTempApiKey(localKey);
        }
      }
    });

    return () => unsubscribe();
  }, [syncStatus]);

  useEffect(() => {
    if (!todayNotice.words || todayNotice.words.length <= 1) {
      setActiveNoticeIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setActiveNoticeIdx(prev => (prev + 1) % todayNotice.words.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [todayNotice.words]);

  const extractHexColor = (themeText) => {
    if (!themeText) return '#37352F';
    const match = themeText.match(/\[(.*?)\]/);
    return match ? match[1] : '#37352F';
  };

  useEffect(() => {
    const initSortable = () => {
      if (typeof window === 'undefined') return;
      if (!window.Sortable) {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js";
        script.async = true;
        script.onload = () => bindSortableContainers();
        document.head.appendChild(script);
      } else {
        bindSortableContainers();
      }
    };

    const bindSortableContainers = () => {
      const containers = document.querySelectorAll('.day-events-container');
      containers.forEach(container => {
        if (container && window.Sortable) {
          const oldSortable = window.Sortable.get(container);
          if (oldSortable) oldSortable.destroy();

          window.Sortable.create(container, {
            group: 'shared-day-group',
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: async (evt) => {
              const targetContainer = evt.to;
              const targetDate = targetContainer.getAttribute('data-date');
              if (!targetDate) return;

              const cardElements = targetContainer.querySelectorAll('.event-card');
              const reorderedIds = Array.from(cardElements).map(el => el.getAttribute('data-id'));

              setEvents(prevEvents => {
                const updated = prevEvents.map(ev => {
                  if (reorderedIds.includes(ev.id)) {
                    const newIndex = reorderedIds.indexOf(ev.id);
                    const freshDayOrder = { ...(ev.dayOrder || {}), [targetDate]: newIndex };
                    saveSingleEventData(ev.id, { ...ev, dayOrder: freshDayOrder });
                    return { ...ev, dayOrder: freshDayOrder };
                  }
                  return ev;
                });
                return updated;
              });
            }
          });
        }
      });
    };

    if (events.length > 0) {
      setTimeout(() => {
        initSortable();
      }, 100);
    }
  }, [events, currentDate, activeSidePanel]);

  const saveSingleEventData = async (eventId, fullPayload) => {
    if (syncStatus === 'connected' && db) {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', eventId);
        await setDoc(docRef, fullPayload, { merge: true });
      } catch (err) {
        console.error("Firestore order update fail:", err);
      }
    }
    const savedEvents = localStorage.getItem('local_school_events');
    if (savedEvents) {
      const arr = JSON.parse(savedEvents);
      const idx = arr.findIndex(item => item.id === eventId);
      if (idx !== -1) {
        arr[idx] = fullPayload;
      } else {
        arr.push(fullPayload);
      }
      localStorage.setItem('local_school_events', JSON.stringify(arr));
    }
  };

  const handleUpdateNotice = async () => {
    /* [수정] 문자열 trim 대신 각 항목의 text/author를 각각 정리하고,
       내용(text)이 비어있는 행은 저장 시 자동으로 제외 */
    const cleanWords = noticeFormList
      .map(w => ({ text: (w.text || '').trim(), author: (w.author || '').trim() }))
      .filter(w => w.text);
    const finalWords = cleanWords.length > 0 ? cleanWords : [{ text: '', author: '' }];
    const updated = { ...todayNotice, words: finalWords };
    setTodayNotice(updated);
    setActiveNoticeIdx(0);
    setIsNoticeEditOpen(false);

    if (syncStatus === 'connected' && db) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notices', 'board'), updated, { merge: true });
        showToast("오늘의 한마디가 연동 저장되었습니다.", "success");
      } catch (err) {
        console.error("Notice save fail:", err);
      }
    }
  };

  const handleUpdateDday = async () => {
    const updated = { ...todayNotice, ddayLabel: ddayForm.label.trim(), ddayTarget: ddayForm.date };
    setTodayNotice(updated);
    setIsDdayEditOpen(false);

    if (syncStatus === 'connected' && db) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notices', 'board'), updated, { merge: true });
        showToast("디데이 설정이 성공적으로 수정되었습니다.", "success");
      } catch (err) {
        console.error("Dday save fail:", err);
      }
    }
  };

  const handleAddCategorySubmit = async () => {
    if (!newCategoryName.trim()) return showToast("카테고리명을 입력해 주세요.", "error");
    if (categories[newCategoryName.trim()]) return showToast("이미 존재하는 카테고리입니다.", "error");

    const updatedCategories = {
      ...categories,
      [newCategoryName.trim()]: NOTION_PALETTES[selectedPaletteKey]
    };
    setCategories(updatedCategories);
    setNewCategoryName('');

    if (syncStatus === 'connected' && db) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', 'active_list'), updatedCategories);
        showToast(`'${newCategoryName}' 카테고리가 추가되었습니다.`, "success");
      } catch (err) {
        console.error("Category save error:", err);
      }
    }
  };

  const handleDeleteCategory = async (catName) => {
    if (Object.keys(categories).length <= 1) {
      return showToast("적어도 1개 이상의 카테고리가 유지되어야 합니다.", "error");
    }
    const { [catName]: deleted, ...rest } = categories;
    setCategories(rest);

    if (syncStatus === 'connected' && db) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', 'active_list'), rest);
        showToast(`'${catName}' 카테고리가 삭제되었습니다.`, "success");
      } catch (err) {
        console.error("Category delete error:", err);
      }
    }
  };

  const handleSaveApiKeyToLocal = () => {
    localStorage.setItem('user_gemini_api_key', tempApiKey.trim());
    setGeminiApiKey(tempApiKey.trim());
    showToast("개인 컴퓨터용 로컬 세션에 키가 임시 등록되었습니다.", "success");
  };

  const handleShareApiKeyToFirestore = async () => {
    if (!tempApiKey.trim()) return showToast("등록할 API Key를 입력하세요.", "error");

    if (syncStatus === 'connected' && db) {
      try {
        const geminiDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'gemini');
        await setDoc(geminiDocRef, { apiKey: tempApiKey.trim() }, { merge: true });
        setGeminiApiKey(tempApiKey.trim());
        showToast("모든 선생님이 공유하여 바로 사용하도록 저장 완료되었습니다! 🎉", "success");
      } catch (err) {
        console.error("API Key sharing error:", err);
        showToast("파이어베이스 권한 혹은 오류로 실패했습니다.", "error");
      }
    } else {
      showToast("연결 상태가 실시간 모드가 아닙니다. 공유가 불가능합니다.", "error");
    }
  };

  const handleAnalyzeMessengerText = async () => {
    if (!messengerInput.trim()) {
      showToast("분석할 안내 내용을 기입해 주세요.", "error");
      return;
    }

    if (!geminiApiKey.trim()) {
      showToast("톱니바퀴(설정)에서 Gemini API Key를 등록해 주세요!", "error");
      setIsCategoryManageOpen(true);
      return;
    }

    setIsAnalyzing(true);

    try {
      const promptPieces = [
        "너는 학교 교무실 업무를 지원하는 완벽한 AI 비서이다.",
        "아래 제공되는 메신저 공지글 및 전달 텍스트를 정밀 분석하여 학사 일정 정보들을 JSON 형식의 배열로 추출해라.",
        "",
        "[현재 기준 연도]",
        "올해는 2026년이다. 날짜에 연도가 표시되어 있지 않다면 무조건 2026년으로 산정하라. (예: 7월 17일 -> 2026-07-17)",
        "",
        "[핵심 요구사항: 일정 다중 분리 추출]",
        "안내문 내용에 '신청 마감(기한, 제출)'과 '실제 활동(행사, 운영, 일시)'에 대한 날짜가 모두 존재한다면, 절대로 하나로 압축하지 말고 반드시 총 2개의 개별 일정 객체로 분리하여 배열에 담아라.",
        "",
        "1. 첫 번째 일정 객체 (신청 마감):",
        '   - title: "[마감] " 접두사를 붙여 일정명을 작성해라. (예: "[마감] 과학과 현장답사 체험학습 신청")',
        '   - category: 반드시 빈 문자열 "" 로 비워두어라.',
        "   - startDate 및 endDate: 안내문에 적힌 '신청 마감일' 날짜를 적용 (예: 2026-07-17)",
        '   - startTime: 마감 시간이 있다면 "HH:MM" 포맷으로 기입 (예: 저녁 7시면 "19:00"). 없으면 ""',
        '   - memo: "마감 기한 준수\\n신청방법: " + 신청방법 등 마감과 관련된 상세 정보 기입',
        "",
        "2. 두 번째 일정 객체 (실제 활동/행사):",
        '   - title: 일정명을 깔끔하게 작성해라. (예: "과학과 현장답사 체험학습")',
        '   - category: 반드시 빈 문자열 "" 로 비워두어라.',
        '   - startDate 및 endDate: 실제 활동/행사 기간을 적용. 기간형(7/21~7/22)이라면 startDate는 "2026-07-21", endDate는 "2026-07-22"로 정확히 분리해라.',
        '   - startTime 및 endTime: 행사 시간이 있다면 "HH:MM" 포맷으로 기입. 없으면 ""',
        "   - memo: 행사 장소, 대상 인원 등 실제 활동과 관련된 상세 정보 기입",
        "",
        "[시간 포맷 약속]",
        'startTime과 endTime은 반드시 24시간제 "HH:MM" 형식(예: 19:00, 14:00)으로만 작성해야 한다.',
        '숫자로 된 시간 형식을 유출해 낼 수 없다면 절대 한글을 넣지 말고 공백("") 처리하라.',
        "",
        "오직 아래의 JSON 명세(배열 형태)만 완전한 텍스트로 응답하고, 마크다운 기호나 설명은 일절 배제하라:",
        "[",
        "  {",
        '    "title": "추출한 일정명 (필수)",',
        '    "category": "반드시 빈 문자열 \\"\\"으로 비워둘 것 (필수)",',
        '    "startDate": "YYYY-MM-DD 형식 (필수)",',
        '    "endDate": "YYYY-MM-DD 형식 (필수)",',
        '    "startTime": "HH:MM 형식 (없으면 \\"\\")",',
        '    "endTime": "HH:MM 형식 (없으면 \\"\\")",',
        '    "manager": "담당자명 (없으면 빈칸)",',
        '    "location": "장소 (없으면 빈칸)",',
        '    "applyMethod": "신청방법 (없으면 빈칸)",',
        '    "applyCount": "대상인원 (없으면 빈칸)",',
        '    "memo": "상세 설명 및 원문 관련 요약"',
        "  }",
        "]"
      ];

      const systemPrompt = promptPieces.join("\n");

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: systemPrompt },
                { text: `[분석할 메신저 원문]\n${messengerInput}` }
              ]
            }]
          })
        }
      );

      if (!response.ok) {
        throw new Error("Gemini API 호출에 실패했습니다.");
      }

      const resData = await response.json();
      const rawText = resData.candidates[0].content.parts[0].text;

      const cleanJsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedArray = JSON.parse(cleanJsonStr);

      if (Array.isArray(parsedArray)) {
        const mapped = parsedArray.map(item => ({
          ...item,
          category: '',
          id: crypto.randomUUID(),
          dayOrder: {}
        }));
        setParsedProposals(mapped);
        showToast("Gemini AI가 일정을 추출했습니다. 등록 전 카테고리를 지정해 주세요!", "success");
      } else {
        throw new Error("올바른 응답 형식이 아닙니다.");
      }

    } catch (err) {
      console.error("Gemini AI Parsing Error:", err);
      showToast("AI 분석 중 오류가 발생했습니다.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateProposalCategory = (proposalId, categoryName) => {
    setParsedProposals(prev =>
      prev.map(p => p.id === proposalId ? { ...p, category: categoryName } : p)
    );
    setActiveProposalCatDropdownId(null);
  };

  const handleAddSingleProposalCard = async (proposalId) => {
    const card = parsedProposals.find(p => p.id === proposalId);
    if (!card) return;

    if (!card.category) {
      showToast("캘린더에 등록하기 전에 카테고리를 선택해 주세요!", "error");
      setActiveProposalCatDropdownId(proposalId);
      return;
    }

    const payload = {
      title: card.title.trim(),
      category: card.category,
      manager: card.manager.trim() || '익명 교사',
      startDate: card.startDate,
      endDate: card.endDate || card.startDate,
      startTime: card.startTime || '',
      endTime: card.endTime || '',
      location: card.location || '',
      applyMethod: card.applyMethod || '',
      applyCount: card.applyCount || '',
      memo: card.memo || '',
      createdAt: new Date().toISOString(),
      dayOrder: {}
    };

    if (syncStatus === 'connected' && db) {
      try {
        const docRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'events'));
        await setDoc(docRef, payload);
        showToast(`'${card.title}' 일정을 캘린더에 동기화 등록했습니다.`, "success");
      } catch (err) {
        console.error("Firebase card write error:", err);
        saveLocalEvent(payload);
      }
    } else {
      saveLocalEvent({ ...payload, id: crypto.randomUUID() });
    }

    setParsedProposals(prev => prev.filter(p => p.id !== proposalId));
  };

  /* 일렉트론 테두리 제어 및 윈도우 컨트롤 액션 헬퍼 */
  const handleToggleAlwaysOnTop = () => {
    const nextState = !isAlwaysOnTop;
    setIsAlwaysOnTop(nextState);
    if (window.electronAPI) {
      window.electronAPI.setAlwaysOnTop(nextState);
      showToast(nextState ? "항상 위에 고정되었습니다." : "항상 위 고정이 해제되었습니다.", "info");
    }
  };

  const handleToggleMoveLock = () => {
    const nextState = !isMoveLocked;
    setIsMovelocked(nextState);
    if (window.electronAPI) {
      window.electronAPI.setMovable(!nextState);
      showToast(nextState ? "프로그램 창 이동이 잠겼습니다." : "프로그램 창 이동 제한이 풀렸습니다.", "info");
    }
  };

  const handleOpacityChange = (value) => {
    setOpacityValue(value);
    if (window.electronAPI) {
      window.electronAPI.setOpacity(value);
    }
  };

  const handleMinimize = () => window.electronAPI && window.electronAPI.minimize();
  const handleMaximize = () => window.electronAPI && window.electronAPI.maximize();
  const handleClose = () => window.electronAPI && window.electronAPI.close();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const fetchNeisMealData = async (targetYear, targetMonth) => {
    const formattedMonth = String(targetMonth + 1).padStart(2, '0');
    const yyyymm = `${targetYear}${formattedMonth}`;
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${neisConfig.key}&Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${neisConfig.officeCode}&SD_SCHUL_CODE=${neisConfig.schoolCode}&MLSV_YMD=${yyyymm}`;

    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const data = await response.json();

      if (data.mealServiceDietInfo) {
        const rows = data.mealServiceDietInfo[1].row;
        const mealMap = {};

        rows.forEach(row => {
          const dateKey = `${row.MLSV_YMD.substring(0,4)}-${row.MLSV_YMD.substring(4,6)}-${row.MLSV_YMD.substring(6,8)}`;
          const cleanDiet = row.DDISH_NM
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/[0-9.()]/g, '')
            .trim();

          if (!mealMap[dateKey]) {
            mealMap[dateKey] = { lunch: null, dinner: null };
          }
          if (row.MMEAL_SC_CODE === "2") {
            mealMap[dateKey].lunch = { diet: cleanDiet, calories: row.CAL_INFO };
          } else if (row.MMEAL_SC_CODE === "3") {
            mealMap[dateKey].dinner = { diet: cleanDiet, calories: row.CAL_INFO };
          }
        });
        setMeals(mealMap);
      } else {
        setMeals({});
      }
    } catch (err) {
      console.error("나이스 급식 파싱 실패:", err);
    }
  };

  useEffect(() => {
    fetchNeisMealData(year, month);
  }, [currentDate]);

  const selectedDateStr = useMemo(() => {
    return formatDateString(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  }, [selectedDate]);

  const activeDayMeal = useMemo(() => {
    return meals[selectedDateStr] || null;
  }, [meals, selectedDateStr]);

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (activeCategoryFilters.length > 0 && !activeCategoryFilters.includes(event.category)) {
        return false;
      }
      return true;
    });
  }, [events, activeCategoryFilters]);

  const handleAddEventSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!newEvent.title.trim()) return showToast("일정 제목을 입력해 주세요.", "error");
    if (!newEvent.startDate) return showToast("시작일을 선택해 주세요.", "error");

    if (newEvent.manager.trim()) {
      localStorage.setItem('school_calendar_manager', newEvent.manager);
    }

    const payload = {
      title: newEvent.title.trim(),
      category: newEvent.category,
      manager: newEvent.manager.trim() || '익명 교사',
      startDate: newEvent.startDate,
      endDate: newEvent.endDate || newEvent.startDate,
      startTime: newEvent.startTime.trim(),
      endTime: newEvent.endTime.trim(),
      location: newEvent.location.trim(),
      applyMethod: newEvent.applyMethod.trim(),
      applyCount: newEvent.applyCount.trim(),
      memo: newEvent.memo.trim(),
      createdAt: new Date().toISOString(),
      dayOrder: {}
    };

    if (syncStatus === 'connected' && db) {
      try {
        const docRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'events'));
        await setDoc(docRef, payload);
        showToast("일정이 연동 및 공유되었습니다.", "success");
      } catch (err) {
        console.error("Firebase write error:", err);
        saveLocalEvent(payload);
      }
    } else {
      saveLocalEvent({ ...payload, id: crypto.randomUUID() });
    }

    setIsAddModalOpen(false);
    setNewEvent({
      title: '',
      category: Object.keys(categories)[0] || '기타',
      manager: localStorage.getItem('school_calendar_manager') || '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      location: '',
      applyMethod: '',
      applyCount: '',
      memo: ''
    });
  };

  const saveLocalEvent = (payload) => {
    const updated = [...events, payload];
    setEvents(updated);
    localStorage.setItem('local_school_events', JSON.stringify(updated));
    showToast("로컬 브라우저 가상 보관소에 기록되었습니다.", "success");
  };

  const handleUpdateEvent = async () => {
    if (!editEventForm.title.trim()) return showToast("제목을 입력해 주세요.", "error");
    if (!editEventForm.startDate) return showToast("시작일을 선택해 주세요.", "error");

    const payload = {
      title: editEventForm.title.trim(),
      category: editEventForm.category,
      manager: editEventForm.manager.trim() || '익명 교사',
      startDate: editEventForm.startDate,
      endDate: editEventForm.endDate || editEventForm.startDate,
      startTime: editEventForm.startTime.trim(),
      endTime: editEventForm.endTime.trim(),
      location: editEventForm.location.trim(),
      applyMethod: editEventForm.applyMethod.trim(),
      applyCount: editEventForm.applyCount.trim(),
      memo: editEventForm.memo.trim()
    };

    if (syncStatus === 'connected' && db) {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', editEventForm.id);
        await setDoc(docRef, payload, { merge: true });
        showToast("일정 수정 사항이 정상 반영되었습니다.", "success");
      } catch (err) {
        console.error("Firebase update error:", err);
      }
    } else {
      const updated = events.map(ev => ev.id === editEventForm.id ? { ...ev, ...payload } : ev);
      setEvents(updated);
      localStorage.setItem('local_school_events', JSON.stringify(updated));
      showToast("수정 완료되었습니다.", "success");
    }
    setIsEditing(false);
    setIsDetailModalOpen(false);
    setSelectedEvent(null);
  };

  const handleDeleteEvent = async (eventId) => {
    if (syncStatus === 'connected' && db) {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', eventId);
        await deleteDoc(docRef);
        showToast("일정이 삭제되었습니다.", "success");
      } catch (err) {
        console.error("Firebase delete error:", err);
      }
    } else {
      const updated = events.filter(ev => ev.id !== eventId);
      setEvents(updated);
      localStorage.setItem('local_school_events', JSON.stringify(updated));
      showToast("일정이 삭제되었습니다.", "success");
    }
    setIsDetailModalOpen(false);
    setSelectedEvent(null);
  };

  const toggleSidePanel = (panelName) => {
    if (activeSidePanel === panelName) {
      setActiveSidePanel(null);
    } else {
      setActiveSidePanel(panelName);
    }
  };

  const calculatedDdayValue = useMemo(() => {
    if (!todayNotice.ddayTarget) return '?';
    const target = new Date(todayNotice.ddayTarget + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '─Day';
    return diffDays > 0 ? `-${diffDays}` : `+${Math.abs(diffDays)}`;
  }, [todayNotice.ddayTarget]);

  /* 💡 [버그 해결 핵심] 참조 크래시를 유발시켰던 그리드 기반 날짜 연산 상수를 return문 직전 스코프로 명확히 배치 이동 */
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const prevDaysInMonth = new Date(year, month, 0).getDate();

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#37352F] font-sans antialiased flex flex-col select-none">
      <style dangerouslySetInnerHTML={{__html: `
        .sortable-ghost { opacity: 0.35 !important; }
        .sortable-chosen { transform: scale(1.02) !important; box-shadow: 0 6px 18px rgba(0,0,0,0.2) !important; transition: transform 0.1s ease; }
        .drag-handle { cursor: grab; opacity: 0.55; font-weight: 700; padding: 0 4px; }
        .drag-handle:active { cursor: grabbing !important; }
        .window-drag-region { -webkit-app-region: drag; }
        .window-no-drag { -webkit-app-region: no-drag; }
      `}} />

      {/* Toast Alert */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce flex items-center gap-3 bg-white border border-[#E9E9E6] px-5 py-4 rounded-lg shadow-lg max-w-sm transition-all">
          <div className="p-1.5 rounded-full bg-[#DDEDEA] text-[#1C3D27]">
            <Check className="w-4 h-4" />
          </div>
          <p className="text-sm font-medium leading-tight">{toast.message}</p>
        </div>
      )}

      {/* 헤드구역(Header) */}
      <header className="bg-white border-b border-[#E9E9E6] px-6 py-3 sticky top-0 z-40 shadow-xs window-drag-region flex items-center justify-between">
          <div className="flex items-center gap-4 shrink-0 window-no-drag">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#F7F7F5] border border-[#E9E9E6] rounded-md">
                <CalendarIcon className="w-5 h-5 text-[#37352F]" />
              </div>
              <div>
                <h1 className="text-base font-black flex items-center gap-2">교무실 공유 캘린더</h1>
                <p className="text-[11px] text-gray-500 font-medium">2026년 솔내고 2학년실</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs bg-[#F7F7F5] border border-[#E9E9E6] px-3 py-1.5 rounded-full font-medium">
              {syncStatus === 'connected' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  <span className="text-emerald-700 font-semibold">실시간 연동중</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"></span>
                  <span className="text-gray-600">오프라인 모드</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 window-no-drag">
            <button
              type="button" onClick={handleToggleAlwaysOnTop}
              className={`p-1.5 rounded-md transition-colors ${isAlwaysOnTop ? 'bg-rose-50 text-rose-600 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Pin className={`w-4 h-4 ${isAlwaysOnTop ? 'rotate-45 fill-current' : ''}`} />
            </button>

            <button
              type="button" onClick={handleToggleMoveLock}
              className={`p-1.5 rounded-md transition-colors ${isMoveLocked ? 'bg-amber-50 text-amber-600 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {isMoveLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button
                type="button" onClick={() => setIsOpacityDropdownOpen(!isOpacityDropdownOpen)}
                className={`p-1.5 rounded-md transition-colors ${opacityValue < 1.0 ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <Eye className="w-4 h-4" />
              </button>
              {isOpacityDropdownOpen && (
                <div className="absolute right-0 mt-2 bg-white border border-[#E9E9E6] p-3 rounded-lg shadow-xl z-50 w-44 flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] font-bold text-gray-500">
                    <span>투명도 조절</span>
                    <span>{Math.round(opacityValue * 100)}%</span>
                  </div>
                  <input
                    type="range" min="0.2" max="1.0" step="0.05" value={opacityValue}
                    onChange={(e) => handleOpacityChange(e.target.value)}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-700"
                  />
                  <button onClick={() => setIsOpacityDropdownOpen(false)} className="mt-1 text-[10px] text-center bg-gray-100 text-gray-600 py-1 rounded font-bold hover:bg-gray-200">설정 완료</button>
                </div>
              )}
            </div>

            <div className="w-px h-4 bg-gray-300 mx-1"></div>
            <button onClick={handleMinimize} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-800 rounded-md"><Minus className="w-3.5 h-3.5" /></button>
            <button onClick={handleMaximize} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-800 rounded-md"><Square className="w-3 h-3" /></button>
            <button onClick={handleClose} className="p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 rounded-md"><X className="w-3.5 h-3.5" /></button>
          </div>
      </header>

      {/* 수직 다단 정렬 사이드 도크 구조 */}
      <div className="flex-1 flex flex-row min-w-0 w-full relative overflow-hidden">

        {/* 메인보드 영역 */}
        <div className="flex-1 flex flex-col gap-6 p-4 md:p-6 min-w-0 overflow-y-auto">
          <div className="grid grid-cols-1 gap-6 items-stretch w-full xl:grid-cols-5">
            {/* 오늘의 한마디 패널 */}
            <div className="xl:col-span-4 bg-white border border-[#EAE4F2] shadow-xs rounded-xl px-4 py-3 flex items-center justify-between min-w-0">
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                <span className="text-xs font-bold text-[#461146] flex items-center gap-1.5 shrink-0 bg-[#EAE4F2] px-2.5 py-1 rounded-full">
                  <MessageSquare className="w-3.5 h-3.5" /> 오늘의 한마디
                </span>
                {/* [수정] 한마디 본문과 함께 작성자(author)도 표시 */}
                <div className="text-[#37352F] text-sm md:text-base font-semibold truncate border-l border-gray-200 pl-3 flex-1 flex items-baseline gap-2">
                  <span className="truncate">{todayNotice.words && todayNotice.words[activeNoticeIdx] && todayNotice.words[activeNoticeIdx].text ? todayNotice.words[activeNoticeIdx].text : '등록된 한마디가 없습니다.'}</span>
                  {todayNotice.words && todayNotice.words[activeNoticeIdx] && todayNotice.words[activeNoticeIdx].author && (
                    <span className="text-xs text-gray-400 font-medium shrink-0">- {todayNotice.words[activeNoticeIdx].author}</span>
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

            {/* 디데이 대시보드 */}
            <div className="xl:col-span-1 bg-white border border-rose-200 shadow-xs rounded-xl px-4 py-3 flex items-center justify-between min-w-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="p-2 bg-rose-50 rounded-lg text-rose-600 shrink-0"><Pin className="w-3.5 h-3.5" /></span>
                <div className="text-left overflow-hidden">
                  {todayNotice.ddayTarget ? (
                    <p className="text-sm font-bold text-gray-700 truncate">
                      <span className="font-black text-rose-600 mr-1.5 text-base">D{calculatedDdayValue}</span>
                      {todayNotice.ddayLabel}
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-gray-400">설정 없음</p>
                  )}
                </div>
              </div>
              <button onClick={() => { setDdayForm({ label: todayNotice.ddayLabel || '', date: todayNotice.ddayTarget || new Date().toISOString().split('T')[0] }); setIsDdayEditOpen(true); }} className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-2 transition-colors">+ 등록</button>
            </div>
          </div>

          {/* 달력 컨테이너 */}
          {/* ===================================================================
              [수정] 급식 정보 / AI 분석 패널 배치 방식 변경
              - 이전: 캘린더 위쪽에 전체 너비 카드로 표시(캘린더 폭 영향 없음)
              - 변경: "오늘의 한마디 + 디데이" 그리드와 동일한 xl:grid-cols-5 구조를
                     이 아래 그리드에도 그대로 적용하여, 패널이 열리면
                     캘린더는 오늘의 한마디와 같은 폭(xl:col-span-4)으로 줄어들고,
                     패널은 디데이와 같은 폭(xl:col-span-1)으로 디데이 바로 아래
                     칸에 정렬되어 나타납니다. 패널이 닫히면 캘린더는 다시
                     전체 너비(xl:col-span-5)로 복귀합니다.
              =================================================================== */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start w-full">
            <section className={`${activeSidePanel ? 'xl:col-span-4' : 'xl:col-span-5'} bg-white border border-[#E9E9E6] rounded-lg p-5 shadow-sm flex flex-col min-h-187.5 min-w-0 transition-all duration-300`}>
              <div className="flex items-center justify-between pb-5 border-b border-[#E9E9E6] mb-5">
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

              <div className="grid grid-cols-[0.8fr_1.2fr_1.2fr_1.2fr_1.2fr_1.2fr_0.8fr] gap-2 text-center font-bold text-xs text-gray-500 mb-2 select-none">
                <div className="py-2 text-rose-500">일</div>
                <div className="py-2">월</div>
                <div className="py-2">화</div>
                <div className="py-2">수</div>
                <div className="py-2">목</div>
                <div className="py-2">금</div>
                <div className="py-2 text-sky-500">토</div>
              </div>

              <div className="grid grid-cols-[0.8fr_1.2fr_1.2fr_1.2fr_1.2fr_1.2fr_0.8fr] gap-2 flex-1 min-h-125 w-full min-w-0">
                {Array.from({ length: firstDayIndex }).map((_, idx) => (
                  <div key={`prev-${idx}`} className="bg-[#F7F7F5]/50 border border-dashed border-[#E9E9E6]/50 rounded-md p-2 text-gray-300 text-xs text-left overflow-hidden min-w-0">
                    {prevDaysInMonth - firstDayIndex + idx + 1}
                  </div>
                ))}

                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dateStr = formatDateString(year, month, dayNum);

                  const dayEvents = filteredEvents
                    .filter(event => dateStr >= event.startDate && dateStr <= (event.endDate || event.startDate))
                    .sort((a, b) => {
                      const orderA = a.dayOrder && a.dayOrder[dateStr] !== undefined ? a.dayOrder[dateStr] : 999;
                      const orderB = b.dayOrder && b.dayOrder[dateStr] !== undefined ? b.dayOrder[dateStr] : 999;
                      return orderA - orderB;
                    });

                  const isToday = new Date().getDate() === dayNum && new Date().getMonth() === month && new Date().getFullYear() === year;
                  const isSelected = selectedDate.getDate() === dayNum && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
                  const currentDayOfWeek = new Date(year, month, dayNum).getDay();

                  return (
                    <div
                      key={`day-${dayNum}`}
                      onClick={() => setSelectedDate(new Date(year, month, dayNum))}
                      onDoubleClick={() => {
                        setSelectedDate(new Date(year, month, dayNum));
                        setNewEvent(prev => ({ ...prev, startDate: dateStr, endDate: dateStr }));
                        setIsAddModalOpen(true);
                      }}
                      className={`border rounded-md p-2 min-h-36 flex flex-col justify-between transition cursor-pointer relative w-full min-w-0 overflow-hidden ${
                        isToday ? 'bg-[#FBF3DB]/40 border-amber-300 ring-1 ring-amber-300' : isSelected ? 'bg-gray-50 border-gray-400' : 'bg-white border-[#E9E9E6] hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex justify-between items-center shrink-0">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isToday ? 'bg-[#FBF3DB] text-[#402A00]' : currentDayOfWeek === 0 ? 'text-rose-500' : currentDayOfWeek === 6 ? 'text-sky-500' : 'text-gray-700'}`}>{dayNum}</span>
                        <button onClick={(e) => { e.stopPropagation(); setNewEvent(prev => ({ ...prev, startDate: dateStr, endDate: dateStr })); setIsAddModalOpen(true); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 rounded transition"><Plus className="w-3.5 h-3.5 text-gray-500" /></button>
                      </div>

                      <div data-date={dateStr} className="day-events-container mt-1 flex-1 overflow-y-auto space-y-1 max-h-28 scrollbar-none min-w-0 pb-1">
                        {dayEvents.map(event => {
                          const theme = categories[event.category] || categories['기타'] || NOTION_PALETTES.gray;
                          const textColor = extractHexColor(theme.text);
                          return (
                            <div
                              key={event.id} data-id={event.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); setIsDetailModalOpen(true); }}
                              className="event-card text-xs leading-normal px-2 py-1 rounded border shadow-[0_1px_1px_rgba(0,0,0,0.02)] font-semibold break-keep flex items-center justify-between gap-1"
                              style={{ backgroundColor: theme.color || '#EAE4F2', color: textColor, borderColor: theme.color || '#E3E2E0' }}
                              title={event.title}
                            >
                              <div className="flex items-start gap-1 min-w-0 flex-1">
                                {event.startDate !== event.endDate && <CalendarDays className="w-3 h-3 shrink-0 opacity-70 mt-0.5" />}
                                <span className="truncate flex-1">{event.title}</span>
                              </div>
                              <span className="drag-handle text-gray-400 hover:text-gray-800 transition-colors pl-1" onClick={(e) => e.stopPropagation()}>
                                <Menu className="w-3 h-3 shrink-0" />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ===================================================================
                [수정] 급식 정보 / AI 분석 패널 (디데이와 동일한 xl:col-span-1 폭)
                - "실시간 식단표" / "AI 스케줄 비서" 타이틀바를 제거하고,
                  해당 카드 콘텐츠(급식 카드 또는 AI 분석 카드)만 노출합니다.
                - 닫기는 카드 우측 상단의 작은 X 아이콘 또는 우측 독(dock)의
                  같은 버튼을 다시 누르는 방식으로 동일하게 동작합니다.
                =================================================================== */}
            {activeSidePanel && (
              <div className="xl:col-span-1 bg-white border border-[#E9E9E6] rounded-xl shadow-sm p-4 relative min-w-0 animate-in fade-in slide-in-from-top-2 duration-200">
                <button
                  onClick={() => setActiveSidePanel(null)}
                  className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-all z-10"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* 급식 정보 카드 */}
                {activeSidePanel === 'meal' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
                      <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg"><Utensils className="w-4 h-4" /></div>
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">오늘 급식 정보</h3>
                        <p className="text-[10px] text-gray-400 tracking-tight">{selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 식단 명세</p>
                      </div>
                    </div>

                    {activeDayMeal && (activeDayMeal.lunch || activeDayMeal.dinner) ? (
                      <div className="space-y-3 animate-in fade-in duration-200">
                        {activeDayMeal.lunch ? (
                          <div className="space-y-1">
                            <div className="text-[11px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 inline-block rounded border border-emerald-100">☀️ 중식 구성</div>
                            <div className="bg-[#F7F7F5] p-2.5 rounded-lg border border-gray-100 text-xs text-gray-700 font-semibold whitespace-pre-wrap leading-relaxed">
                              {activeDayMeal.lunch.diet}
                            </div>
                            <p className="text-[9px] text-right text-gray-400 font-bold">열량: {activeDayMeal.lunch.calories}</p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 italic bg-gray-50/60 p-2 rounded text-center border border-dashed">중식 미운영 일자</p>
                        )}

                        {activeDayMeal.dinner ? (
                          <div className="space-y-1 pt-1 border-t border-gray-100 border-dashed">
                            <div className="text-[11px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 inline-block rounded border border-amber-100">🌙 석식 구성</div>
                            <div className="bg-[#F7F7F5] p-2.5 rounded-lg border border-gray-100 text-xs text-gray-700 font-semibold whitespace-pre-wrap leading-relaxed">
                              {activeDayMeal.dinner.diet}
                            </div>
                            <p className="text-[9px] text-right text-gray-400 font-bold">열량: {activeDayMeal.dinner.calories}</p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 italic bg-gray-50/60 p-2 rounded text-center border border-dashed">석식 미운영 일자</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic text-center py-5 bg-[#F7F7F5]/40 rounded-lg border border-dashed border-gray-200">
                        지정된 급식 정보가 존재하지 않습니다.
                      </p>
                    )}
                  </div>
                )}

                {/* AI 분석 카드 */}
                {activeSidePanel === 'ai' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
                      <div className="p-1.5 bg-purple-50 text-purple-700 rounded-lg animate-pulse"><Sparkles className="w-4 h-4" /></div>
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">Gemini AI 분석기</h3>
                        <p className="text-[10px] text-gray-400">전달 글에서 공지를 적시 가공합니다</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <textarea
                        rows={8}
                        placeholder="메신저 본문 전체를 복사하여 붙여넣으세요!&#10;활동일과 신청기간을 인공지능이 영리하게 구분하여 분석 제안합니다."
                        value={messengerInput}
                        onChange={(e) => setMessengerInput(e.target.value)}
                        className="w-full p-2.5 border border-[#E9E9E6] rounded-lg bg-[#F7F7F5]/50 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 placeholder:text-gray-400 leading-relaxed"
                      />
                      <button
                        type="button" onClick={handleAnalyzeMessengerText}
                        className="w-full py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-purple-400 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        {isAnalyzing ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> <span>분석 가동중...</span></>
                        ) : (
                          <><Sparkles className="w-3.5 h-3.5" /> <span>AI 메신저 분석</span></>
                        )}
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
                                <div className="flex items-center justify-between relative">
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setActiveProposalCatDropdownId(activeProposalCatDropdownId === proposal.id ? null : proposal.id)}
                                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${hasSelectedCategory ? `${theme.bg} ${theme.text} ${theme.border}` : 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'}`}
                                    >
                                      <span>{proposal.category || '⚠️ 카테고리 선택'}</span>
                                      <ChevronDown className="w-2.5 h-2.5" />
                                    </button>
                                    {/* 💡 [오류 수정] 분기 오발 오타 코드를 정규 비교 객체식으로 안전하게 정정 교정 완료 */}
                                    {activeProposalCatDropdownId === proposal.id && (
                                      <div className="absolute left-0 mt-1 w-36 bg-white border border-[#E9E9E6] rounded-md shadow-xl z-50 max-h-40 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                                        {Object.entries(categories).map(([catName, styling]) => (
                                          <button key={catName} type="button" onClick={() => handleUpdateProposalCategory(proposal.id, catName)} className="w-full px-2 py-1.5 text-left hover:bg-[#F7F7F5] flex items-center gap-1.5 border-b border-gray-50 last:border-0">
                                            <span className={`w-2 h-2 rounded-full ${styling.bg} border ${styling.border} shrink-0`}></span>
                                            <span className="text-[9px] font-semibold text-gray-700">{catName}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-gray-400 font-bold flex items-center gap-0.5"><CalendarIcon className="w-2.5 h-2.5 text-gray-300" /> {proposal.startDate}</span>
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-sm font-bold text-[#37352F] break-all">{proposal.title}</h4>
                                  <div className="grid grid-cols-1 gap-0.5 text-[10px] text-gray-500">
                                    {proposal.startTime && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5 text-gray-400" /> {proposal.startTime}</span>}
                                    {proposal.location && <span className="flex items-center gap-1 text-purple-700 font-medium"><MapPin className="w-2.5 h-2.5 text-purple-400" /> {proposal.location}</span>}
                                  </div>
                                </div>
                                <button type="button" onClick={() => handleAddSingleProposalCard(proposal.id)} className={`w-full py-1.5 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 ${hasSelectedCategory ? 'bg-[#37352F] text-white hover:bg-black' : 'bg-gray-100 text-amber-800 border border-amber-200'}`}>
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
              </div>
            )}
          </div>
        </div>

        {/* 우측 독바 고정 도크 (급식/AI 패널 여닫기 트리거는 그대로 유지) */}
        <div className="w-14 bg-white border-l border-[#E9E9E6] flex flex-col items-center py-4 justify-start gap-5 z-40 shrink-0 window-no-drag shadow-xs">
          <button
            type="button" onClick={() => toggleSidePanel('meal')}
            className={`p-2.5 rounded-xl transition-all relative group border ${activeSidePanel === 'meal' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 scale-105 shadow-xs' : 'border-transparent text-gray-400 hover:bg-[#F7F7F5] hover:text-gray-700'}`}
          >
            <Utensils className="w-5 h-5" />
          </button>

          <button
            type="button" onClick={() => toggleSidePanel('ai')}
            className={`p-2.5 rounded-xl transition-all relative group border ${activeSidePanel === 'ai' ? 'bg-purple-50 border-purple-200 text-purple-700 scale-105 shadow-xs' : 'border-transparent text-gray-400 hover:bg-[#F7F7F5] hover:text-gray-700'}`}
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 1. Add Event Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E9E9E6] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E9E9E6] pb-3">
              <h3 className="text-base font-bold text-[#37352F] flex items-center gap-2"><Plus className="w-5 h-5 text-purple-700" /> 신규 일정 등록</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 hover:bg-gray-100 rounded transition"><X className="w-5 h-5" /></button>
            </div>

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
                      <span className={`w-3 h-3 rounded-full ${(categories[newEvent.category] || NOTION_PALETTES.gray).bg} border ${(categories[newEvent.category] || NOTION_PALETTES.gray).border}`}></span>
                      <span className="font-semibold text-xs">{newEvent.category}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                  {isAddCatDropdownOpen && (
                    <div className="absolute left-0 right-0 top-13.5 bg-white border border-[#E9E9E6] rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                      {Object.entries(categories).map(([catName, styling]) => (
                        <button key={catName} type="button" onClick={() => { setNewEvent(prev => ({ ...prev, category: catName })); setIsAddCatDropdownOpen(false); }} className="w-full px-3 py-2 text-left hover:bg-[#F7F7F5] flex items-center gap-2 border-b border-gray-50 last:border-0">
                          <span className={`w-3 h-3 rounded-full ${styling.bg} border ${styling.border} shrink-0`}></span>
                          <span className={`${styling.text} font-semibold text-xs rounded px-1.5 py-0.5 ${styling.bg}`}>{catName}</span>
                        </button>
                      ))}
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
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-2 border border-[#E9E9E6] text-gray-600 rounded-md hover:bg-gray-100 font-medium">취소</button>
                <button type="submit" className="flex-1 py-2 bg-[#37352F] hover:bg-black text-white rounded-md font-medium">캘린더에 게시</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Detail & Action Management Modal */}
      {isDetailModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E9E9E6] rounded-xl shadow-2xl w-full max-w-2xl p-6 space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#E9E9E6] pb-3">
                  <h3 className="text-base font-bold text-[#37352F] flex items-center gap-1.5"><Edit3 className="w-5 h-5" /> 일정 상세 정보 변경</h3>
                  <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-3 text-sm max-h-[70vh] overflow-y-auto pr-1">
                  <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">일정 제목 *</label><input type="text" value={editEventForm.title} onChange={(e) => setEditEventForm(prev => ({ ...prev, title: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col relative">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">카테고리 *</label>
                      <button type="button" onClick={() => setIsEditCatDropdownOpen(!isEditCatDropdownOpen)} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] flex items-center justify-between text-left">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${(categories[editEventForm.category] || NOTION_PALETTES.gray).bg} border ${(categories[editEventForm.category] || NOTION_PALETTES.gray).border}`}></span>
                          <span className="font-semibold text-xs">{editEventForm.category}</span>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </button>
                      {isEditCatDropdownOpen && (
                        <div className="absolute left-0 right-0 top-13.5 bg-white border border-[#E9E9E6] rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                          {Object.entries(categories).map(([catName, styling]) => (
                            <button key={catName} type="button" onClick={() => { setEditEventForm(prev => ({ ...prev, category: catName })); setIsEditCatDropdownOpen(false); }} className="w-full px-3 py-2 text-left hover:bg-[#F7F7F5] flex items-center gap-2 border-b border-gray-50 last:border-0">
                              <span className={`w-3 h-3 rounded-full ${styling.bg} border ${styling.border} shrink-0`}></span>
                              <span className={`${styling.text} font-semibold text-xs rounded px-1.5 py-0.5 ${styling.bg}`}>{catName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">담당 교사</label><input type="text" value={editEventForm.manager} onChange={(e) => setEditEventForm(prev => ({ ...prev, manager: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                    <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">시작일 *</label><input type="date" value={editEventForm.startDate} onChange={(e) => setEditEventForm(prev => ({ ...prev, startDate: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                    <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">종료일</label><input type="date" value={editEventForm.endDate} onChange={(e) => setEditEventForm(prev => ({ ...prev, endDate: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                    <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">시작 시간</label><input type="time" value={editEventForm.startTime} onChange={(e) => setEditEventForm(prev => ({ ...prev, startTime: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                    <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">종료 시간</label><input type="time" value={editEventForm.endTime} onChange={(e) => setEditEventForm(prev => ({ ...prev, endTime: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                    <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">장소</label><input type="text" value={editEventForm.location} onChange={(e) => setEditEventForm(prev => ({ ...prev, location: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                    <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">신청인원 / 대상</label><input type="text" value={editEventForm.applyCount} onChange={(e) => setEditEventForm(prev => ({ ...prev, applyCount: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                  </div>
                  <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">신청방법 / 링크</label><input type="text" value={editEventForm.applyMethod} onChange={(e) => setEditEventForm(prev => ({ ...prev, applyMethod: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>
                  <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">메모</label><textarea rows={3} value={editEventForm.memo} onChange={(e) => setEditEventForm(prev => ({ ...prev, memo: e.target.value }))} className="w-full p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] focus:outline-none" /></div>

                  <div className="flex gap-2 pt-3 border-t border-[#E9E9E6]">
                    <button onClick={() => setIsEditing(false)} className="flex-1 py-2 border border-[#E9E9E6] text-gray-600 rounded-md hover:bg-gray-100 font-medium">취소</button>
                    <button onClick={handleUpdateEvent} className="flex-1 py-2 bg-[#37352F] text-white rounded-md font-medium">변경 저장</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#E9E9E6] pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${(categories[selectedEvent.category] || NOTION_PALETTES.gray).bg} ${(categories[selectedEvent.category] || NOTION_PALETTES.gray).text}`}>{selectedEvent.category}</span>
                    <span className="text-xs text-gray-400 font-medium">{selectedEvent.startDate} {selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate && `~ ${selectedEvent.endDate}`}</span>
                  </div>
                  <button onClick={() => { setIsDetailModalOpen(false); setSelectedEvent(null); }} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
                </div>

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
                  <div className="text-[11px] text-gray-400">즉시 수정 및 삭제가 가능한 공유형 모드 상태입니다.</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditEventForm({
                          id: selectedEvent.id, title: selectedEvent.title, category: selectedEvent.category, manager: selectedEvent.manager || '',
                          startDate: selectedEvent.startDate || '', endDate: selectedEvent.endDate || '', startTime: selectedEvent.startTime || '',
                          endTime: selectedEvent.endTime || '', location: selectedEvent.location || '', applyMethod: selectedEvent.applyMethod || '',
                          applyCount: selectedEvent.applyCount || '', memo: selectedEvent.memo || ''
                        });
                        setIsEditing(true);
                      }}
                      className="flex items-center gap-1 border border-[#E9E9E6] text-gray-600 px-3 py-1.5 rounded-md text-xs font-semibold"
                    ><Edit3 className="w-3.5 h-3.5" /> 수정</button>
                    <button onClick={() => handleDeleteEvent(selectedEvent.id)} className="flex items-center gap-1 border border-rose-200 text-rose-600 px-3 py-1.5 rounded-md text-xs font-semibold"><Trash2 className="w-3.5 h-3.5" /> 삭제</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. 설정 모달 */}
      {isCategoryManageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E9E9E6] rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E9E9E6] pb-3">
              <h3 className="text-base font-bold text-[#37352F] flex items-center gap-2"><Settings className="w-5 h-5 text-gray-600" /> 교무실 통합 제어 설정</h3>
              <button onClick={() => setIsCategoryManageOpen(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-purple-50/50 border border-purple-100 p-3.5 rounded-lg space-y-3">
              <p className="text-xs font-bold text-purple-900">Gemini AI 비서 API 키 설정</p>
              <input type="password" placeholder="AI_STUDIO_API_KEY 입력" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} className="w-full p-2 border border-purple-200 rounded text-xs bg-white focus:outline-none" />
              <div className="flex gap-2">
                <button type="button" onClick={handleSaveApiKeyToLocal} className="flex-1 py-1.5 border border-purple-300 text-purple-700 text-xs font-bold rounded">내PC에만 임시등록</button>
                <button type="button" onClick={handleShareApiKeyToFirestore} className="flex-1 py-1.5 bg-purple-700 text-white text-xs font-bold rounded">전체교사 공유저장</button>
              </div>
            </div>

            <div className="bg-[#F7F7F5] p-3.5 rounded-lg border border-[#E9E9E6] space-y-3">
              <p className="text-xs font-bold text-gray-600">새 카테고리 추가</p>
              <input type="text" placeholder="카테고리 명칭 입력" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="w-full p-2 border border-[#E9E9E6] rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-400" />

              {/* [추가] 카테고리 색상 선택 - 팔레트 동그라미 */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">색상 선택</p>
                <div className="flex items-center flex-wrap gap-2.5">
                  {Object.entries(NOTION_PALETTES).map(([paletteKey, styling]) => (
                    <button
                      key={paletteKey}
                      type="button"
                      title={styling.label}
                      onClick={() => setSelectedPaletteKey(paletteKey)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${styling.bg} ${selectedPaletteKey === paletteKey ? 'border-[#37352F] scale-110 shadow-sm' : 'border-white hover:scale-105'}`}
                    ></button>
                  ))}
                </div>
              </div>

              <button onClick={handleAddCategorySubmit} className="w-full py-2 bg-emerald-700 text-white rounded text-xs font-bold">+ 등록</button>

              {/* [추가] 현재 저장된 카테고리 목록 - 색상 확인 및 즉시 삭제 가능 */}
              <div className="pt-3 border-t border-[#E9E9E6] space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">저장된 카테고리 ({Object.keys(categories).length}개)</p>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {Object.entries(categories).map(([catName, styling]) => (
                    <div key={catName} className="flex items-center justify-between bg-white border border-[#E9E9E6] rounded-md px-2.5 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-3 h-3 rounded-full ${styling.bg} border ${styling.border} shrink-0`}></span>
                        <span className="text-xs font-semibold text-gray-700 truncate">{catName}</span>
                      </div>
                      <button type="button" onClick={() => handleDeleteCategory(catName)} className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setIsCategoryManageOpen(false)} className="w-full py-2 bg-gray-100 text-gray-700 rounded text-xs font-bold">설정 닫기</button>
          </div>
        </div>
      )}

      {/* 4. 오늘의 한마디 수정 모달 */}
      {isNoticeEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E9E9E6] rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-[#37352F]">오늘의 한마디 리스트 수정</h3>
            {noticeFormList.map((notice, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input type="text" value={notice} onChange={(e) => { const copy = [...noticeFormList]; copy[idx] = e.target.value; setNoticeFormList(copy); }} className="flex-1 p-2 border border-[#E9E9E6] rounded bg-[#F7F7F5] text-xs" />
              </div>
            ))}
            <button type="button" onClick={() => setNoticeFormList([...noticeFormList, ''])} className="w-full py-2 border border-dashed text-purple-700 rounded text-xs font-bold">+ 행 추가</button>
            <div className="flex gap-2 justify-end"><button onClick={() => setIsNoticeEditOpen(false)} className="px-4 py-2 border text-gray-600 rounded text-xs">취소</button><button onClick={handleUpdateNotice} className="px-4 py-2 bg-purple-700 text-white rounded text-xs">저장</button></div>
          </div>
        </div>
      )}

      {/* 5. 디데이 설정 모달 */}
      {isDdayEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E9E9E6] rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-[#37352F]">학년 디데이(D-Day) 설정</h3>
            <input type="text" placeholder="이벤트 이름" value={ddayForm.label} onChange={(e) => setDdayForm(prev => ({ ...prev, label: e.target.value }))} className="w-full p-2 border text-xs rounded" />
            <input type="date" value={ddayForm.date} onChange={(e) => setDdayForm(prev => ({ ...prev, date: e.target.value }))} className="w-full p-2 border text-xs rounded" />
            <div className="flex gap-2 justify-end"><button onClick={() => setIsDdayEditOpen(false)} className="px-4 py-2 border text-gray-600 rounded text-xs">취소</button><button onClick={handleUpdateDday} className="px-4 py-2 bg-rose-600 text-white rounded text-xs">완료</button></div>
          </div>
        </div>
      )}
    </div>
  );
}