// src/components/fishtank/decorations.jsx
import React from 'react';

/* ==========================================================================
   어항 장식 & 배경 (SVG 커스텀 일러스트)
   - 모든 장식은 "바닥에 놓이는" 기준이라 viewBox 하단이 지면입니다.
   - 슬롯(0~4)은 어항을 가로로 5등분한 위치입니다.
   ========================================================================== */

/* ---------------------------- 수초 ---------------------------- */
const Seaweed = () => (
  <svg viewBox="0 0 70 100" className="w-full h-full">
    <g className="ft-sway" style={{ transformOrigin: '35px 100px', animationDuration: '4.2s' }}>
      <path d="M33 100 C26 78 34 62 28 44 C24 32 30 20 36 10" stroke="#15803D" strokeWidth="7" fill="none" strokeLinecap="round" />
    </g>
    <g className="ft-sway" style={{ transformOrigin: '20px 100px', animationDuration: '3.4s', animationDelay: '-1.1s' }}>
      <path d="M20 100 C14 82 20 66 16 52 C13 42 17 34 22 26" stroke="#16A34A" strokeWidth="6" fill="none" strokeLinecap="round" />
    </g>
    <g className="ft-sway" style={{ transformOrigin: '50px 100px', animationDuration: '5s', animationDelay: '-2.3s' }}>
      <path d="M50 100 C56 84 48 70 54 56 C58 46 54 38 50 30" stroke="#4ADE80" strokeWidth="5.5" fill="none" strokeLinecap="round" />
    </g>
    <g className="ft-sway" style={{ transformOrigin: '43px 100px', animationDuration: '3.8s', animationDelay: '-0.6s' }}>
      <path d="M43 100 C46 86 40 74 44 62" stroke="#22C55E" strokeWidth="4.5" fill="none" strokeLinecap="round" opacity="0.85" />
    </g>
  </svg>
);

/* ---------------------------- 조개 ---------------------------- */
const Shell = () => (
  <svg viewBox="0 0 56 40" className="w-full h-full">
    <path d="M4 38 C4 16 14 4 28 4 C42 4 52 16 52 38 Z" fill="#F9A8D4" />
    <path d="M28 4 L28 38" stroke="#FBCFE8" strokeWidth="2" opacity="0.8" />
    <path d="M28 4 C22 16 18 26 16 38" stroke="#FBCFE8" strokeWidth="2" fill="none" opacity="0.8" />
    <path d="M28 4 C34 16 38 26 40 38" stroke="#FBCFE8" strokeWidth="2" fill="none" opacity="0.8" />
    <path d="M28 4 C24 14 22 20 21 38" stroke="#F472B6" strokeWidth="1.2" fill="none" opacity="0.5" />
    <ellipse cx="28" cy="38" rx="26" ry="3" fill="#EC4899" opacity="0.35" />
    <circle cx="28" cy="30" r="4" fill="#FFFFFF" opacity="0.9" />
    <circle cx="26.5" cy="28.5" r="1.4" fill="#FDF2F8" />
  </svg>
);

/* -------------------------- 바위더미 -------------------------- */
const Rocks = () => (
  <svg viewBox="0 0 96 56" className="w-full h-full">
    <path d="M2 56 C6 34 20 22 34 26 C46 30 50 44 48 56 Z" fill="#64748B" />
    <path d="M34 56 C34 36 48 22 64 26 C80 30 86 42 84 56 Z" fill="#475569" />
    <path d="M56 56 C58 44 68 36 78 40 C88 44 92 50 92 56 Z" fill="#94A3B8" />
    <path d="M12 50 C16 40 22 34 30 34" stroke="#94A3B8" strokeWidth="2.5" fill="none" opacity="0.6" strokeLinecap="round" />
    <path d="M48 50 C52 40 60 32 70 33" stroke="#64748B" strokeWidth="2.5" fill="none" opacity="0.6" strokeLinecap="round" />
    <ellipse cx="24" cy="30" rx="6" ry="3" fill="#CBD5E1" opacity="0.4" />
  </svg>
);

/* ---------------------------- 산호 ---------------------------- */
const Coral = () => (
  <svg viewBox="0 0 80 86" className="w-full h-full">
    <g className="ft-sway" style={{ transformOrigin: '40px 86px', animationDuration: '6s' }}>
      <path d="M38 86 L38 52" stroke="#FB7185" strokeWidth="9" strokeLinecap="round" />
      <path d="M38 62 C28 56 22 44 24 32" stroke="#FB7185" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M38 58 C50 52 56 40 54 28" stroke="#F43F5E" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M38 52 C38 40 42 30 40 18" stroke="#FDA4AF" strokeWidth="6.5" fill="none" strokeLinecap="round" />
      <path d="M24 38 C18 32 16 24 18 16" stroke="#FDA4AF" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M54 34 C60 28 64 22 62 14" stroke="#FB7185" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="18" cy="14" r="4" fill="#FECDD3" />
      <circle cx="62" cy="12" r="4.5" fill="#FECDD3" />
      <circle cx="40" cy="16" r="4" fill="#FFE4E6" />
    </g>
    <ellipse cx="38" cy="84" rx="18" ry="4" fill="#BE123C" opacity="0.25" />
  </svg>
);

/* ----------------------------- 성 ----------------------------- */
const Castle = () => (
  <svg viewBox="0 0 104 116" className="w-full h-full">
    <rect x="10" y="52" width="84" height="64" fill="#A8A29E" />
    <rect x="10" y="52" width="84" height="6" fill="#78716C" />
    <rect x="4" y="26" width="24" height="90" fill="#D6D3D1" />
    <rect x="76" y="26" width="24" height="90" fill="#D6D3D1" />
    <path d="M4 26 L16 8 L28 26 Z" fill="#0EA5E9" />
    <path d="M76 26 L88 8 L100 26 Z" fill="#0EA5E9" />
    <rect x="40" y="30" width="24" height="26" fill="#E7E5E4" />
    <path d="M40 30 L52 14 L64 30 Z" fill="#0284C7" />
    <path d="M52 14 L52 4 L64 8 L52 11 Z" fill="#F43F5E" />
    <path d="M40 78 C40 66 64 66 64 78 L64 116 L40 116 Z" fill="#57534E" />
    <circle cx="16" cy="46" r="4.5" fill="#44403C" />
    <circle cx="88" cy="46" r="4.5" fill="#44403C" />
    <rect x="46" y="38" width="12" height="12" rx="1" fill="#44403C" />
    <rect x="22" y="70" width="10" height="14" rx="4" fill="#44403C" opacity="0.75" />
    <rect x="72" y="70" width="10" height="14" rx="4" fill="#44403C" opacity="0.75" />
    <ellipse cx="52" cy="114" rx="46" ry="4" fill="#57534E" opacity="0.3" />
  </svg>
);

/* --------------------------- 난파선 --------------------------- */
const Shipwreck = () => (
  <svg viewBox="0 0 136 88" className="w-full h-full">
    <path d="M8 62 C22 84 104 88 128 66 C120 60 100 56 68 56 C36 56 16 58 8 62 Z" fill="#78350F" />
    <path d="M14 63 C28 78 100 82 122 66" stroke="#92400E" strokeWidth="3" fill="none" opacity="0.8" />
    <path d="M26 58 L30 20" stroke="#92400E" strokeWidth="6" strokeLinecap="round" />
    <path d="M84 56 L92 26" stroke="#92400E" strokeWidth="5" strokeLinecap="round" />
    <g className="ft-sway" style={{ transformOrigin: '30px 24px', animationDuration: '5.5s' }}>
      <path d="M31 22 C48 26 52 34 34 40 Z" fill="#E7E5E4" opacity="0.55" />
    </g>
    <path d="M40 60 L40 46 L52 46 L52 60 Z" fill="#451A03" opacity="0.85" />
    <circle cx="66" cy="64" r="5" fill="#451A03" opacity="0.8" />
    <circle cx="88" cy="66" r="4" fill="#451A03" opacity="0.8" />
    <path d="M96 60 C104 52 116 54 118 62" stroke="#16A34A" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.8" />
    <ellipse cx="68" cy="84" rx="58" ry="4" fill="#451A03" opacity="0.25" />
  </svg>
);

/* ==========================================================================
   장식 카탈로그
   ========================================================================== */
export const DECORATIONS = [
  { id: 'seaweed', name: '수초', price: 150, w: 70, h: 100, desc: '하늘하늘 흔들리는 초록 수초', Component: Seaweed },
  { id: 'shell', name: '조개', price: 180, w: 56, h: 40, desc: '진주가 살짝 보이는 분홍 조개', Component: Shell },
  { id: 'rock', name: '바위더미', price: 220, w: 96, h: 56, desc: '물고기가 숨기 좋은 자리', Component: Rocks },
  { id: 'coral', name: '산호', price: 350, w: 80, h: 86, desc: '어항을 화사하게 만드는 산호 군락', Component: Coral },
  { id: 'castle', name: '성', price: 650, w: 104, h: 116, desc: '어항의 랜드마크가 되는 작은 성', Component: Castle },
  { id: 'ship', name: '난파선', price: 900, w: 136, h: 88, desc: '보물이 잠들어 있을 것 같은 침몰선', Component: Shipwreck },
];

export const DECO_MAP = DECORATIONS.reduce((acc, d) => {
  acc[d.id] = d;
  return acc;
}, {});

/* ==========================================================================
   배경(수질) 카탈로그
   ========================================================================== */
export const BACKGROUNDS = [
  {
    id: 'default',
    name: '맑은 물',
    price: 0,
    desc: '기본 어항. 햇살이 잘 드는 맑은 물',
    sky: '#BAE6FD',
    mid: '#38BDF8',
    deep: '#0284C7',
    sand: '#FDE68A',
    sandDark: '#FBBF24',
    glass: 'rgba(255,255,255,0.35)',
  },
  {
    id: 'deep',
    name: '심해',
    price: 500,
    desc: '깊고 고요한 밤바다 느낌',
    sky: '#1E40AF',
    mid: '#172554',
    deep: '#020617',
    sand: '#475569',
    sandDark: '#1E293B',
    glass: 'rgba(148,163,184,0.22)',
  },
  {
    id: 'sunset',
    name: '노을',
    price: 500,
    desc: '해질 무렵 붉게 물든 물빛',
    sky: '#FDBA74',
    mid: '#FB7185',
    deep: '#6D28D9',
    sand: '#FDE68A',
    sandDark: '#F59E0B',
    glass: 'rgba(255,255,255,0.3)',
  },
];

export const BG_MAP = BACKGROUNDS.reduce((acc, b) => {
  acc[b.id] = b;
  return acc;
}, {});

export const getBackground = (bgId) => BG_MAP[bgId] || BACKGROUNDS[0];

/* 장식이 놓일 수 있는 슬롯 개수 (어항을 가로로 5등분) */
export const DECO_SLOT_COUNT = 5;
