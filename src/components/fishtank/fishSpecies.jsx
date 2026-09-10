// src/components/fishtank/fishSpecies.jsx
import React from 'react';

/* ==========================================================================
   물고기 도감 (SVG 커스텀 일러스트)
   - 모든 물고기는 "오른쪽을 바라보는" 상태로 그립니다.
     헤엄치는 방향이 왼쪽이면 FishTankPanel 쪽에서 scaleX(-1)로 뒤집습니다.
   - viewBox는 전부 0 0 100 60 으로 통일 (가로:세로 = 5:3)
   - color: 몸통색 / accent: 지느러미·무늬색
   ========================================================================== */

// 공통 눈
const Eye = ({ cx, cy, r = 3.2 }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="#FFFFFF" />
    <circle cx={cx + r * 0.28} cy={cy} r={r * 0.55} fill="#1F2937" />
  </g>
);

// 공통 SVG 래퍼
const Body = ({ children }) => (
  <svg viewBox="0 0 100 60" className="w-full h-full" style={{ overflow: 'visible' }}>
    {children}
  </svg>
);

/* ---------------------------- 1. 구피 ---------------------------- */
const Guppy = ({ color, accent }) => (
  <Body>
    <g className="ft-tail" style={{ transformOrigin: '40px 30px' }}>
      <path d="M42 30 C26 15 12 8 4 6 C11 20 11 40 4 54 C12 52 26 45 42 30 Z" fill={accent} opacity="0.85" />
      <path d="M42 30 C32 22 22 17 14 15 C19 22 19 38 14 45 C22 43 32 38 42 30 Z" fill={accent} opacity="0.5" />
    </g>
    <path d="M54 17 C62 6 74 8 78 17 Z" fill={accent} opacity="0.85" />
    <path d="M54 43 C61 54 71 53 75 45 Z" fill={accent} opacity="0.65" />
    <ellipse cx="58" cy="30" rx="30" ry="14" fill={color} />
    <ellipse cx="58" cy="35" rx="25" ry="8" fill="#FFFFFF" opacity="0.2" />
    <Eye cx={78} cy={26} r={3.4} />
  </Body>
);

/* ------------------------- 2. 네온테트라 ------------------------- */
const NeonTetra = ({ color, accent }) => (
  <Body>
    <g className="ft-tail" style={{ transformOrigin: '36px 30px' }}>
      <path d="M38 30 L10 15 L18 30 L10 45 Z" fill={accent} opacity="0.9" />
    </g>
    <path d="M52 20 L66 12 L68 21 Z" fill={accent} opacity="0.55" />
    <ellipse cx="56" cy="30" rx="30" ry="11" fill={color} />
    <path d="M28 29 C44 25 68 25 86 29 C68 33 44 33 28 33 Z" fill="#22D3EE" opacity="0.9" />
    <path d="M40 33 C56 34 72 34 84 32 C74 39 56 40 44 37 Z" fill="#F43F5E" opacity="0.75" />
    <Eye cx={78} cy={27} r={3} />
  </Body>
);

/* ---------------------------- 3. 금붕어 ---------------------------- */
const Goldfish = ({ color, accent }) => (
  <Body>
    <g className="ft-tail" style={{ transformOrigin: '42px 30px' }}>
      <path d="M44 30 C28 10 12 1 2 3 C13 17 13 43 2 57 C13 58 28 50 44 30 Z" fill={accent} opacity="0.6" />
      <path d="M44 30 C32 19 18 13 8 15 C16 23 16 37 8 45 C18 47 32 41 44 30 Z" fill={accent} opacity="0.45" />
    </g>
    <path d="M56 13 C66 2 78 7 82 15 Z" fill={accent} opacity="0.8" />
    <path d="M58 47 C66 58 76 55 79 47 Z" fill={accent} opacity="0.6" />
    <ellipse cx="60" cy="30" rx="29" ry="19" fill={color} />
    <ellipse cx="58" cy="37" rx="21" ry="10" fill="#FFFFFF" opacity="0.18" />
    <path className="ft-fin" style={{ transformOrigin: '66px 34px' }} d="M64 33 C58 38 58 46 64 47 Z" fill={accent} opacity="0.7" />
    <Eye cx={79} cy={24} r={4} />
  </Body>
);

/* --------------------------- 4. 엔젤피시 --------------------------- */
const Angelfish = ({ color, accent }) => (
  <Body>
    <g className="ft-tail" style={{ transformOrigin: '38px 30px' }}>
      <path d="M40 30 L16 17 L22 30 L16 43 Z" fill={accent} opacity="0.8" />
    </g>
    <path d="M60 26 L48 -6 L70 6 Z" fill={accent} opacity="0.75" />
    <path d="M60 34 L48 66 L70 54 Z" fill={accent} opacity="0.75" />
    <path d="M40 30 C45 12 62 3 77 15 C88 24 88 36 77 45 C62 57 45 48 40 30 Z" fill={color} />
    <rect x="58" y="6" width="6" height="48" rx="2" fill={accent} opacity="0.4" />
    <rect x="72" y="10" width="5" height="40" rx="2" fill={accent} opacity="0.3" />
    <path d="M54 44 C53 55 54 60 57 62" stroke={accent} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.7" />
    <Eye cx={78} cy={26} r={3.4} />
  </Body>
);

/* ---------------------------- 5. 복어 ---------------------------- */
const Puffer = ({ color, accent, puffed }) => {
  const spikes = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const r1 = 23, r2 = 30;
    const cx = 52, cy = 30;
    const x1 = cx + Math.cos(a) * r1;
    const y1 = cy + Math.sin(a) * r1;
    const x2 = cx + Math.cos(a) * r2;
    const y2 = cy + Math.sin(a) * r2;
    const px = cx + Math.cos(a + 0.16) * r1;
    const py = cy + Math.sin(a + 0.16) * r1;
    return <path key={i} d={`M${x1} ${y1} L${x2} ${y2} L${px} ${py} Z`} fill={accent} opacity="0.8" />;
  });
  return (
    <Body>
      <g
        style={{
          transformOrigin: '52px 30px',
          transform: puffed ? 'scale(1.22)' : 'scale(1)',
          transition: 'transform 0.35s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        <g className="ft-tail" style={{ transformOrigin: '30px 30px' }}>
          <path d="M32 30 L14 18 L18 30 L14 42 Z" fill={accent} opacity="0.8" />
        </g>
        {puffed && spikes}
        <circle cx="52" cy="30" r="23" fill={color} />
        <ellipse cx="52" cy="38" rx="18" ry="9" fill="#FFFFFF" opacity="0.22" />
        <circle cx="44" cy="20" r="2.4" fill={accent} opacity="0.5" />
        <circle cx="54" cy="16" r="2" fill={accent} opacity="0.5" />
        <circle cx="40" cy="32" r="2.2" fill={accent} opacity="0.4" />
        <path className="ft-fin" style={{ transformOrigin: '62px 36px' }} d="M60 34 C55 40 56 48 62 48 Z" fill={accent} opacity="0.7" />
        <Eye cx={68} cy={24} r={4} />
        <path d="M72 33 C76 34 78 34 80 33" stroke="#1F2937" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.6" />
      </g>
    </Body>
  );
};

/* ---------------------------- 6. 해마 ---------------------------- */
const Seahorse = ({ color, accent }) => (
  <Body>
    <path
      d="M64 12 C77 15 76 28 64 30 C53 32 49 41 53 49 C56 56 65 56 68 50"
      stroke={color}
      strokeWidth="13"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M72 15 L90 18 L72 23 Z" fill={color} />
    <path d="M60 4 L66 -2 L68 6 Z" fill={accent} opacity="0.8" />
    <path d="M56 12 L60 6 L63 13 Z" fill={accent} opacity="0.7" />
    <path className="ft-fin" style={{ transformOrigin: '58px 26px' }} d="M58 22 C50 22 46 28 52 33 Z" fill={accent} opacity="0.8" />
    <circle cx="61" cy="20" r="1.8" fill={accent} opacity="0.55" />
    <circle cx="56" cy="30" r="1.8" fill={accent} opacity="0.55" />
    <circle cx="52" cy="40" r="1.8" fill={accent} opacity="0.55" />
    <Eye cx={69} cy={15} r={3} />
  </Body>
);

/* --------------------------- 7. 잉어(코이) --------------------------- */
const Koi = ({ color, accent }) => (
  <Body>
    <g className="ft-tail" style={{ transformOrigin: '32px 30px' }}>
      <path d="M34 30 C20 15 8 6 0 6 C9 19 9 41 0 54 C9 54 20 45 34 30 Z" fill={accent} opacity="0.65" />
    </g>
    <path d="M54 13 C63 2 76 6 79 14 Z" fill={accent} opacity="0.7" />
    <path d="M56 46 C64 57 74 54 77 46 Z" fill={accent} opacity="0.55" />
    <path d="M28 30 C34 15 52 7 72 11 C88 14 96 23 96 30 C96 37 88 46 72 49 C52 53 34 45 28 30 Z" fill={color} />
    <ellipse cx="55" cy="20" rx="13" ry="6.5" fill={accent} opacity="0.65" transform="rotate(-12 55 20)" />
    <ellipse cx="72" cy="38" rx="10" ry="5.5" fill={accent} opacity="0.5" transform="rotate(10 72 38)" />
    <ellipse cx="40" cy="32" rx="8" ry="4.5" fill={accent} opacity="0.45" />
    <path className="ft-fin" style={{ transformOrigin: '66px 36px' }} d="M64 34 C58 40 59 49 66 49 Z" fill={accent} opacity="0.6" />
    <path d="M90 33 C95 36 95 41 90 42" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
    <path d="M90 28 C95 30 96 34 92 36" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
    <Eye cx={86} cy={25} r={3.4} />
  </Body>
);

/* ---------------------------- 8. 가오리 ---------------------------- */
const Ray = ({ color, accent }) => (
  <Body>
    <path d="M22 32 C10 36 4 42 0 52 C8 50 16 44 24 36 Z" fill={color} opacity="0.85" />
    <path
      className="ft-fin"
      style={{ transformOrigin: '60px 30px' }}
      d="M20 30 C34 8 62 6 82 19 C89 24 90 32 82 37 C62 48 34 46 20 30 Z"
      fill={color}
    />
    <path d="M34 26 C48 18 66 18 78 24 C66 27 48 28 34 26 Z" fill="#FFFFFF" opacity="0.18" />
    <ellipse cx="58" cy="34" rx="16" ry="6" fill={accent} opacity="0.3" />
    <Eye cx={78} cy={23} r={2.8} />
  </Body>
);

/* ==========================================================================
   물고기 색상 팔레트 (구매 시 선택)
   ========================================================================== */
export const FISH_COLORS = [
  { id: 'orange', name: '주황', body: '#FB923C', fin: '#F97316' },
  { id: 'blue', name: '파랑', body: '#60A5FA', fin: '#2563EB' },
  { id: 'pink', name: '분홍', body: '#F472B6', fin: '#DB2777' },
  { id: 'mint', name: '민트', body: '#34D399', fin: '#059669' },
  { id: 'purple', name: '보라', body: '#A78BFA', fin: '#7C3AED' },
  { id: 'gold', name: '금색', body: '#FBBF24', fin: '#D97706' },
  { id: 'silver', name: '은색', body: '#CBD5E1', fin: '#64748B' },
  { id: 'red', name: '빨강', body: '#F87171', fin: '#DC2626' },
];

export const getFishColor = (colorId) =>
  FISH_COLORS.find((c) => c.id === colorId) || FISH_COLORS[0];

/* ==========================================================================
   도감 데이터
   - width : 어항 안에서의 기본 가로 크기(px), 세로는 width * 0.6
   - speed : 프레임(16.7ms)당 이동 픽셀
   - mode  : 'swim'(자유) | 'vertical'(위아래 위주) | 'bottom'(바닥 근처)
   - depth : 어항 높이 대비 활동 구간 [위, 아래]
   ========================================================================== */
export const FISH_SPECIES = [
  {
    id: 'guppy',
    name: '구피',
    price: 100,
    width: 42,
    speed: 1.15,
    mode: 'swim',
    depth: [0.08, 0.85],
    desc: '작고 부지런히 헤엄치는 입문용 물고기',
    Component: Guppy,
  },
  {
    id: 'neon',
    name: '네온테트라',
    price: 180,
    width: 38,
    speed: 1.45,
    mode: 'swim',
    depth: [0.12, 0.7],
    desc: '형광 줄무늬가 빛나는 빠른 물고기',
    Component: NeonTetra,
  },
  {
    id: 'goldfish',
    name: '금붕어',
    price: 350,
    width: 56,
    speed: 0.75,
    mode: 'swim',
    depth: [0.1, 0.82],
    desc: '느긋하게 유영하는 풍성한 꼬리의 주인공',
    Component: Goldfish,
  },
  {
    id: 'angel',
    name: '엔젤피시',
    price: 600,
    width: 58,
    speed: 0.9,
    mode: 'swim',
    depth: [0.06, 0.7],
    desc: '길게 늘어진 지느러미가 우아한 물고기',
    Component: Angelfish,
  },
  {
    id: 'puffer',
    name: '복어',
    price: 900,
    width: 52,
    speed: 0.62,
    mode: 'swim',
    depth: [0.15, 0.85],
    desc: '클릭하면 빵빵하게 부풀어 오릅니다',
    Component: Puffer,
  },
  {
    id: 'seahorse',
    name: '해마',
    price: 1300,
    width: 40,
    speed: 0.42,
    mode: 'vertical',
    depth: [0.15, 0.88],
    desc: '위아래로 천천히 오르내리는 신비한 친구',
    Component: Seahorse,
  },
  {
    id: 'koi',
    name: '잉어',
    price: 2000,
    width: 76,
    speed: 0.68,
    mode: 'swim',
    depth: [0.08, 0.78],
    desc: '어항의 주인공이 되는 대형 비단잉어',
    Component: Koi,
  },
  {
    id: 'ray',
    name: '가오리',
    price: 3000,
    width: 80,
    speed: 0.55,
    mode: 'bottom',
    depth: [0.55, 0.92],
    desc: '바닥 가까이를 미끄러지듯 나아갑니다',
    Component: Ray,
  },
];

export const SPECIES_MAP = FISH_SPECIES.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {});

export const getSpecies = (speciesId) => SPECIES_MAP[speciesId] || FISH_SPECIES[0];
