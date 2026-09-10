// src/components/FishTankPanel.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Fish, X, ShoppingBag, Users, Coins, Trash2, Check, Lock, Utensils, Sparkles, Edit2 } from 'lucide-react';
import { FISH_SPECIES, getSpecies, FISH_COLORS, getFishColor } from './fishtank/fishSpecies';
import { DECORATIONS, DECO_MAP, BACKGROUNDS, getBackground, DECO_SLOT_COUNT } from './fishtank/decorations';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/* 마지막 먹이 시각으로 포만도(0~100) 계산 — 타이머 없이 계산만으로 처리 */
export const calcFullness = (lastFedAt) => {
  if (!lastFedAt) return 40;
  const hours = (Date.now() - new Date(lastFedAt).getTime()) / 3600000;
  return clamp(Math.round(100 - hours * 5), 0, 100); // 20시간이면 0
};

/* ==========================================================================
   어항 씬 — 내 어항 / 남의 어항 구경 양쪽에서 함께 사용
   물고기 위치는 React state가 아니라 rAF에서 DOM transform을 직접 만져
   초당 60회 리렌더가 일어나지 않도록 했습니다. (항상 켜두는 앱이라 CPU 절약이 중요)
   ========================================================================== */
export const TankScene = ({ tank, height = 250, paused = false, interactive = true, feedTick = 0, onSelectFish }) => {
  const containerRef = useRef(null);
  const nodesRef = useRef(new Map());     // fishId -> DOM node
  const stateRef = useRef(new Map());     // fishId -> 물리 상태
  const sizeRef = useRef({ w: 360, h: height });
  const pelletStateRef = useRef(new Map());
  const pelletNodesRef = useRef(new Map());
  const speedFactorRef = useRef(1);
  const [pellets, setPellets] = useState([]);
  const [puffedId, setPuffedId] = useState(null);
  // 🔑 창이 가려지면(최소화·다른 탭) 애니메이션 루프를 완전히 멈춰 CPU를 아낍니다
  const [docHidden, setDocHidden] = useState(typeof document !== 'undefined' ? document.hidden : false);
  const isPaused = paused || docHidden;

  const bg = getBackground(tank?.bgId);
  const fishList = useMemo(() => Object.values(tank?.fish || {}), [tank?.fish]);
  const decoList = useMemo(() => Object.values(tank?.decorations || {}), [tank?.decorations]);
  const fullness = calcFullness(tank?.lastFedAt);
  speedFactorRef.current = 0.55 + (fullness / 100) * 0.55;

  const sandH = Math.round(height * 0.16);

  /* 물결·기포는 한 번만 랜덤 생성 */
  const bubbles = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        id: i,
        left: 6 + Math.random() * 88,
        size: 3 + Math.random() * 6,
        dur: 6 + Math.random() * 7,
        delay: -Math.random() * 12,
      })),
    []
  );

  const pickTarget = useCallback((f, w, h) => {
    const sp = f.sp;
    const maxX = Math.max(1, w - f.fw);
    const minY = sp.depth[0] * h;
    const maxY = Math.max(minY + 1, sp.depth[1] * h - f.fh);
    if (sp.mode === 'vertical') {
      f.tx = clamp(f.x + (Math.random() - 0.5) * 70, 0, maxX);
      f.ty = minY + Math.random() * (maxY - minY);
      f.wait = 500 + Math.random() * 1200;
    } else {
      f.tx = Math.random() * maxX;
      f.ty = minY + Math.random() * (maxY - minY);
      f.wait = Math.random() * 700;
    }
  }, []);

  /* 물고기 목록이 바뀌면 물리 상태를 새로 만들거나 정리 */
  useEffect(() => {
    const { w, h } = sizeRef.current;
    const st = stateRef.current;
    const ids = new Set();
    fishList.forEach((f) => {
      ids.add(f.id);
      if (!st.has(f.id)) {
        const sp = getSpecies(f.speciesId);
        const fw = sp.width;
        const fh = sp.width * 0.6;
        const entry = {
          x: Math.random() * Math.max(1, w - fw),
          y: (sp.depth[0] + Math.random() * (sp.depth[1] - sp.depth[0])) * h,
          dir: Math.random() > 0.5 ? 1 : -1,
          tx: 0,
          ty: 0,
          wait: 0,
          sp,
          fw,
          fh,
        };
        st.set(f.id, entry);
        pickTarget(entry, w, h);
      }
    });
    st.forEach((_, id) => {
      if (!ids.has(id)) {
        st.delete(id);
        nodesRef.current.delete(id);
      }
    });
  }, [fishList, pickTarget]);

  /* 어항 실제 크기 추적 */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = () => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  /* 먹이 투하 */
  useEffect(() => {
    if (!feedTick) return;
    const w = sizeRef.current.w;
    const created = Array.from({ length: 7 }, (_, i) => ({ id: `p_${feedTick}_${i}` }));
    created.forEach((p, i) => {
      pelletStateRef.current.set(p.id, {
        x: 18 + Math.random() * Math.max(10, w - 36),
        y: -10 - i * 16,
      });
    });
    setPellets((prev) => [...prev, ...created]);
  }, [feedTick]);

  /* 메인 애니메이션 루프 */
  useEffect(() => {
    if (isPaused) return;
    let raf = 0;
    let last = performance.now();

    const step = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      const k = dt / 16.67;
      const { w, h } = sizeRef.current;
      const eaten = [];

      // 먹이 낙하
      pelletStateRef.current.forEach((p, id) => {
        p.y += 0.85 * k;
        const node = pelletNodesRef.current.get(id);
        if (node) node.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
        if (p.y > h - sandH * 0.4) eaten.push(id);
      });

      // 물고기 이동
      stateRef.current.forEach((f, id) => {
        let chase = null;
        if (pelletStateRef.current.size > 0) {
          let bestD = Infinity;
          let best = null;
          pelletStateRef.current.forEach((p, pid) => {
            const d = Math.hypot(p.x - (f.x + f.fw / 2), p.y - (f.y + f.fh / 2));
            if (d < bestD) {
              bestD = d;
              best = { pid, p, d };
            }
          });
          if (best) {
            chase = { x: best.p.x - f.fw / 2, y: best.p.y - f.fh / 2 };
            if (best.d < 16) eaten.push(best.pid);
          }
        }

        const tx = chase ? clamp(chase.x, 0, Math.max(0, w - f.fw)) : f.tx;
        const ty = chase ? clamp(chase.y, 0, Math.max(0, h - f.fh)) : f.ty;
        const dx = tx - f.x;
        const dy = ty - f.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = f.sp.speed * speedFactorRef.current * (chase ? 2.3 : 1);

        if (!chase && dist < 5) {
          f.wait -= dt;
          if (f.wait <= 0) pickTarget(f, w, h);
        } else {
          const mv = Math.min(dist, speed * k);
          f.x += (dx / dist) * mv;
          f.y += (dy / dist) * mv;
          if (Math.abs(dx) > 12) f.dir = dx > 0 ? 1 : -1;
        }

        f.x = clamp(f.x, 0, Math.max(0, w - f.fw));
        f.y = clamp(f.y, 0, Math.max(0, h - f.fh));

        const node = nodesRef.current.get(id);
        if (node) {
          const tilt = f.sp.mode === 'vertical' ? 0 : clamp((dy / dist) * 16, -18, 18) * f.dir;
          node.style.transform = `translate3d(${f.x}px, ${f.y}px, 0) rotate(${tilt}deg) scaleX(${f.dir})`;
        }
      });

      if (eaten.length > 0) {
        eaten.forEach((id) => {
          pelletStateRef.current.delete(id);
          pelletNodesRef.current.delete(id);
        });
        setPellets((prev) => prev.filter((p) => pelletStateRef.current.has(p.id)));
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isPaused, pickTarget, sandH]);

  useEffect(() => {
    const onVis = () => setDocHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const handleFishClick = (f) => {
    if (!interactive) return;
    if (f.speciesId === 'puffer') {
      setPuffedId(f.id);
      setTimeout(() => setPuffedId((cur) => (cur === f.id ? null : cur)), 1600);
    }
    if (onSelectFish) onSelectFish(f);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-white/60 shadow-inner select-none"
      style={{
        height,
        background: `linear-gradient(180deg, ${bg.sky} 0%, ${bg.mid} 55%, ${bg.deep} 100%)`,
      }}
    >
      {/* 수면 빛 일렁임 */}
      <div
        className="ft-shimmer absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: '55%',
          background: `linear-gradient(105deg, transparent 20%, ${bg.glass} 42%, transparent 55%, ${bg.glass} 72%, transparent 88%)`,
        }}
      />

      {/* 기포 */}
      {!isPaused &&
        bubbles.map((b) => (
          <span
            key={b.id}
            className="ft-bubble absolute rounded-full bg-white/50 pointer-events-none"
            style={{
              left: `${b.left}%`,
              bottom: `${sandH}px`,
              width: b.size,
              height: b.size,
              animationDuration: `${b.dur}s`,
              animationDelay: `${b.delay}s`,
            }}
          />
        ))}

      {/* 바닥 모래
          🔑 SVG는 대체 요소라 inset-x-0만으로는 가로로 늘어나지 않고 viewBox 비율대로만 그려집니다.
             w-full / width:100% 를 명시해야 어항 폭 끝까지 채워집니다. */}
      <svg
        viewBox="0 0 400 60"
        preserveAspectRatio="none"
        className="absolute left-0 bottom-0 w-full pointer-events-none"
        style={{ height: sandH, width: '100%' }}
      >
        <path d="M0 24 C60 10 120 30 200 20 C270 12 330 28 400 18 L400 60 L0 60 Z" fill={bg.sand} />
        <path d="M0 34 C70 24 130 40 210 32 C280 25 340 38 400 30 L400 60 L0 60 Z" fill={bg.sandDark} opacity="0.75" />
      </svg>

      {/* 장식 */}
      {decoList.map((d) => {
        const meta = DECO_MAP[d.itemId];
        if (!meta) return null;
        const scale = height / 250;
        return (
          <div
            key={d.id}
            className="absolute pointer-events-none"
            style={{
              left: `${((d.slot ?? 0) + 0.5) * (100 / DECO_SLOT_COUNT)}%`,
              bottom: sandH * 0.45,
              width: meta.w,
              height: meta.h,
              transform: `translateX(-50%) scale(${scale})`,
              transformOrigin: 'bottom center',
            }}
          >
            <meta.Component />
          </div>
        );
      })}

      {/* 물고기 */}
      {fishList.map((f) => {
        const sp = getSpecies(f.speciesId);
        const c = getFishColor(f.colorId);
        const Comp = sp.Component;
        return (
          <div
            key={f.id}
            ref={(node) => {
              if (node) nodesRef.current.set(f.id, node);
              else nodesRef.current.delete(f.id);
            }}
            onClick={() => handleFishClick(f)}
            className={interactive ? 'absolute cursor-pointer' : 'absolute'}
            style={{
              left: 0,
              top: 0,
              width: sp.width,
              height: sp.width * 0.6,
              willChange: 'transform',
              transformOrigin: 'center',
            }}
            title={interactive ? f.name : undefined}
          >
            <Comp color={c.body} accent={c.fin} puffed={puffedId === f.id} />
          </div>
        );
      })}

      {/* 먹이 */}
      {pellets.map((p) => (
        <span
          key={p.id}
          ref={(node) => {
            if (node) pelletNodesRef.current.set(p.id, node);
            else pelletNodesRef.current.delete(p.id);
          }}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: 0,
            top: 0,
            width: 5,
            height: 5,
            background: '#B45309',
            boxShadow: '0 0 3px rgba(0,0,0,0.25)',
            willChange: 'transform',
          }}
        />
      ))}

      {/* 비어 있을 때 안내 */}
      {fishList.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/85 pointer-events-none">
          <Fish className="w-7 h-7 opacity-80" />
          <p className="text-[11px] font-bold">아직 어항이 비어 있습니다</p>
          <p className="text-[10px] opacity-80">상점에서 첫 물고기를 데려와 보세요</p>
        </div>
      )}

      {/* 배고픔 안내 */}
      {fishList.length > 0 && fullness < 30 && (
        <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/35 backdrop-blur-xs text-white text-[10px] font-bold pointer-events-none">
          물고기들이 배고파합니다
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
   어항 패널 본체
   ========================================================================== */
export default function FishTankPanel({
  myTank,
  myOwnerId,
  myTeacherName,
  allTanks = {},
  points = 0,
  onBuyFish,
  onFeed,
  onReleaseFish,
  onRenameFish,
  onBuyDeco,
  onRemoveDeco,
  onBuyBackground,
  onSetBackground,
  closeSidePanel,
  orderIndex = 0,
}) {
  const [tab, setTab] = useState('tank'); // 'tank' | 'shop' | 'visit'
  const [shopTab, setShopTab] = useState('fish'); // 'fish' | 'deco' | 'bg'
  const [feedTick, setFeedTick] = useState(0);
  const [notice, setNotice] = useState('');
  const [selectedFish, setSelectedFish] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [buyTarget, setBuyTarget] = useState(null); // 구매하려는 물고기 종
  const [buyName, setBuyName] = useState('');
  const [buyColorId, setBuyColorId] = useState('orange');
  const [visitingId, setVisitingId] = useState(null);

  const fishList = useMemo(() => Object.values(myTank?.fish || {}), [myTank?.fish]);
  const decoList = useMemo(() => Object.values(myTank?.decorations || {}), [myTank?.decorations]);
  const ownedBgs = myTank?.ownedBgs || ['default'];
  const fullness = calcFullness(myTank?.lastFedAt);
  const MAX_FISH = 12;

  const flash = useCallback((msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2600);
  }, []);

  /* 선택한 물고기가 방출되면 상세 카드도 닫기 */
  useEffect(() => {
    if (selectedFish && !myTank?.fish?.[selectedFish.id]) setSelectedFish(null);
  }, [myTank?.fish, selectedFish]);

  const handleFeed = async () => {
    setFeedTick((t) => t + 1);
    const res = await onFeed();
    if (res?.earned) flash(`먹이를 줬습니다. +${res.earned}P`);
    else flash('먹이를 줬습니다.');
  };

  const handleConfirmBuyFish = async () => {
    if (!buyTarget) return;
    const res = await onBuyFish(buyTarget.id, buyName.trim() || buyTarget.name, buyColorId, buyTarget.price);
    if (res?.success) {
      flash(`${buyName.trim() || buyTarget.name} 을(를) 어항에 넣었습니다!`);
      setBuyTarget(null);
      setBuyName('');
      setTab('tank');
    } else {
      flash(res?.error || '구매하지 못했습니다.');
    }
  };

  const handleBuyDecoration = async (deco) => {
    const usedSlots = new Set(decoList.map((d) => d.slot));
    let slot = -1;
    for (let i = 0; i < DECO_SLOT_COUNT; i++) {
      if (!usedSlots.has(i)) {
        slot = i;
        break;
      }
    }
    if (slot === -1) return flash('장식을 놓을 자리가 없습니다. 기존 장식을 치워 주세요.');
    const res = await onBuyDeco(deco.id, slot, deco.price);
    if (res?.success) flash(`${deco.name} 을(를) 어항에 놓았습니다!`);
    else flash(res?.error || '구매하지 못했습니다.');
  };

  const handleBackgroundClick = async (bg) => {
    if (ownedBgs.includes(bg.id)) {
      await onSetBackground(bg.id);
      flash(`배경을 '${bg.name}'(으)로 바꿨습니다.`);
      return;
    }
    const res = await onBuyBackground(bg.id, bg.price);
    if (res?.success) flash(`'${bg.name}' 배경을 구입했습니다!`);
    else flash(res?.error || '구매하지 못했습니다.');
  };

  const otherTanks = useMemo(
    () =>
      Object.values(allTanks)
        .filter((t) => t.id !== myOwnerId && Object.keys(t.fish || {}).length > 0)
        .sort((a, b) => Object.keys(b.fish || {}).length - Object.keys(a.fish || {}).length),
    [allTanks, myOwnerId]
  );

  const visitingTank = visitingId ? allTanks[visitingId] : null;

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
        tab === id ? 'bg-sky-600 text-white shadow-xs' : 'bg-white text-gray-500 hover:bg-sky-50 border border-[#E9E9E6]'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );

  return (
    <aside
      style={{ order: orderIndex }}
      className="w-full bg-white border border-[#E9E9E6] rounded-xl shadow-sm p-4 relative min-w-0 h-fit animate-in fade-in slide-in-from-top-2 duration-200 text-xs"
    >
      <button
        onClick={() => closeSidePanel('fishtank')}
        className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-all z-10"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="space-y-3">
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
          <div className="p-1.5 bg-sky-50 text-sky-700 rounded-lg">
            <Fish className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">나의 어항</h3>
          <span className="ml-auto flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-md font-black text-[11px]">
            <Coins className="w-3.5 h-3.5" />
            {points.toLocaleString()}P
          </span>
        </div>

        {/* 탭 */}
        <div className="flex gap-1.5">
          <TabButton id="tank" label="어항" icon={Fish} />
          <TabButton id="shop" label="상점" icon={ShoppingBag} />
          <TabButton id="visit" label="구경" icon={Users} />
        </div>

        {notice && (
          <div className="px-2.5 py-1.5 bg-sky-50 border border-sky-200 text-sky-800 rounded-md text-[11px] font-bold">
            {notice}
          </div>
        )}

        {/* ================= 어항 탭 ================= */}
        {tab === 'tank' && (
          <div className="space-y-2.5">
            <TankScene tank={myTank} height={250} feedTick={feedTick} onSelectFish={(f) => { setSelectedFish(f); setRenameValue(f.name); }} />

            {/* 포만도 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>포만도</span>
                <span className={fullness < 30 ? 'text-rose-500' : 'text-gray-500'}>{fullness}%</span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    fullness < 30 ? 'bg-rose-400' : fullness < 60 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${fullness}%` }}
                />
              </div>
            </div>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleFeed}
                className="flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5"
              >
                <Utensils className="w-3.5 h-3.5" /> 먹이 주기
              </button>
              <button
                type="button"
                onClick={() => { setTab('shop'); setShopTab('fish'); }}
                className="flex-1 py-2 bg-white border border-[#E9E9E6] hover:bg-gray-50 text-gray-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" /> 상점 가기
              </button>
            </div>

            {/* 선택한 물고기 상세 */}
            {selectedFish && myTank?.fish?.[selectedFish.id] && (
              <div className="bg-[#F7F7F5] border border-[#E9E9E6] rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-6 shrink-0">
                    {(() => {
                      const sp = getSpecies(selectedFish.speciesId);
                      const c = getFishColor(selectedFish.colorId);
                      const Comp = sp.Component;
                      return <Comp color={c.body} accent={c.fin} />;
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-gray-800 truncate">{myTank.fish[selectedFish.id].name}</p>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      {getSpecies(selectedFish.speciesId).name} · {getFishColor(selectedFish.colorId).name}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelectedFish(null)} className="p-1 text-gray-400 hover:text-gray-700 rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={12}
                    placeholder="이름 바꾸기"
                    className="flex-1 p-1.5 border border-[#E9E9E6] rounded bg-white text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-300"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!renameValue.trim()) return;
                      await onRenameFish(selectedFish.id, renameValue.trim());
                      flash('이름을 바꿨습니다.');
                    }}
                    className="px-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-[11px] font-bold flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onReleaseFish(selectedFish.id);
                      setSelectedFish(null);
                      flash('물고기를 바다로 돌려보냈습니다.');
                    }}
                    className="px-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded text-[11px] font-bold"
                    title="방출하기 (포인트는 돌려받지 못합니다)"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* 놓여 있는 장식 */}
            {decoList.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">놓여 있는 장식</p>
                <div className="flex flex-wrap gap-1.5">
                  {decoList.map((d) => {
                    const meta = DECO_MAP[d.itemId];
                    if (!meta) return null;
                    return (
                      <span
                        key={d.id}
                        className="group flex items-center gap-1 pl-2 pr-1 py-1 bg-[#F7F7F5] border border-[#E9E9E6] rounded-md text-[11px] font-bold text-gray-600"
                      >
                        {meta.name}
                        <button
                          type="button"
                          onClick={async () => {
                            await onRemoveDeco(d.id);
                            flash(`${meta.name} 을(를) 치웠습니다.`);
                          }}
                          className="p-0.5 text-gray-300 hover:text-rose-500 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-[10px] text-gray-400 font-semibold text-center">
              물고기 {fishList.length} / {MAX_FISH}마리 · 물고기를 클릭하면 이름을 바꿀 수 있습니다
            </p>
          </div>
        )}

        {/* ================= 상점 탭 ================= */}
        {tab === 'shop' && (
          <div className="space-y-2.5">
            <div className="flex gap-1">
              {[
                { id: 'fish', label: '물고기' },
                { id: 'deco', label: '장식' },
                { id: 'bg', label: '배경' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShopTab(s.id)}
                  className={`flex-1 py-1 rounded-md text-[11px] font-bold border transition-all ${
                    shopTab === s.id
                      ? 'bg-sky-50 border-sky-300 text-sky-700'
                      : 'bg-white border-[#E9E9E6] text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* 물고기 구매 */}
            {shopTab === 'fish' && (
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {FISH_SPECIES.map((sp) => {
                  const affordable = points >= sp.price;
                  const Comp = sp.Component;
                  const isTarget = buyTarget?.id === sp.id;
                  return (
                    <div
                      key={sp.id}
                      className={`border rounded-lg transition-all ${
                        isTarget ? 'border-sky-300 bg-sky-50/40' : 'border-[#E9E9E6] bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setBuyTarget(isTarget ? null : sp);
                          setBuyName('');
                          setBuyColorId('orange');
                        }}
                        className="w-full flex items-center gap-2.5 p-2.5 text-left"
                      >
                        <div className="w-11 h-7 shrink-0">
                          <Comp color="#FB923C" accent="#F97316" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black text-gray-800">{sp.name}</p>
                          <p className="text-[10px] text-gray-400 font-semibold truncate">{sp.desc}</p>
                        </div>
                        <span
                          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black ${
                            affordable ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {affordable ? <Coins className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {sp.price.toLocaleString()}
                        </span>
                      </button>

                      {isTarget && (
                        <div className="px-2.5 pb-2.5 space-y-2 border-t border-sky-100 pt-2">
                          <input
                            type="text"
                            value={buyName}
                            onChange={(e) => setBuyName(e.target.value)}
                            maxLength={12}
                            placeholder={`이름을 지어 주세요 (예: ${sp.name}이)`}
                            className="w-full p-1.5 border border-[#E9E9E6] rounded bg-white text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-300"
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {FISH_COLORS.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                title={c.name}
                                onClick={() => setBuyColorId(c.id)}
                                className={`w-6 h-6 rounded-full border-2 transition-all ${
                                  buyColorId === c.id ? 'border-sky-600 scale-110' : 'border-white hover:scale-105'
                                }`}
                                style={{ background: c.body, boxShadow: '0 0 0 1px #E5E7EB' }}
                              />
                            ))}
                          </div>
                          <div className="h-14 bg-sky-100/60 rounded-md flex items-center justify-center">
                            <div style={{ width: sp.width * 1.2, height: sp.width * 0.72 }}>
                              <Comp color={getFishColor(buyColorId).body} accent={getFishColor(buyColorId).fin} />
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!affordable}
                            onClick={handleConfirmBuyFish}
                            className="w-full py-1.5 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded text-[11px] font-bold flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {affordable ? `${sp.price.toLocaleString()}P 로 데려오기` : '포인트가 부족합니다'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 장식 구매 */}
            {shopTab === 'deco' && (
              <div className="grid grid-cols-2 gap-1.5 max-h-96 overflow-y-auto pr-1">
                {DECORATIONS.map((d) => {
                  const affordable = points >= d.price;
                  const Comp = d.Component;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleBuyDecoration(d)}
                      className="border border-[#E9E9E6] bg-white hover:border-sky-300 rounded-lg p-2 flex flex-col items-center gap-1.5 transition-all"
                    >
                      <div className="h-16 flex items-end justify-center">
                        <div style={{ width: Math.min(d.w, 70), height: Math.min(d.h, 64) }}>
                          <Comp />
                        </div>
                      </div>
                      <p className="text-[11px] font-black text-gray-800">{d.name}</p>
                      <span
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${
                          affordable ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {affordable ? <Coins className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {d.price.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 배경 구매 */}
            {shopTab === 'bg' && (
              <div className="space-y-1.5">
                {BACKGROUNDS.map((bg) => {
                  const owned = ownedBgs.includes(bg.id);
                  const active = (myTank?.bgId || 'default') === bg.id;
                  const affordable = points >= bg.price;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => handleBackgroundClick(bg)}
                      className={`w-full flex items-center gap-2.5 p-2 border rounded-lg transition-all ${
                        active ? 'border-sky-400 bg-sky-50/50' : 'border-[#E9E9E6] bg-white hover:border-sky-200'
                      }`}
                    >
                      <span
                        className="w-14 h-10 rounded-md shrink-0 border border-white/70"
                        style={{ background: `linear-gradient(180deg, ${bg.sky}, ${bg.mid} 55%, ${bg.deep})` }}
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-[11px] font-black text-gray-800">{bg.name}</p>
                        <p className="text-[10px] text-gray-400 font-semibold truncate">{bg.desc}</p>
                      </div>
                      {active ? (
                        <span className="shrink-0 px-2 py-1 bg-sky-600 text-white rounded-md text-[10px] font-black">사용 중</span>
                      ) : owned ? (
                        <span className="shrink-0 px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-[10px] font-black">적용하기</span>
                      ) : (
                        <span
                          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black ${
                            affordable ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {affordable ? <Coins className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {bg.price.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= 구경 탭 ================= */}
        {tab === 'visit' && (
          <div className="space-y-2.5">
            {visitingTank ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVisitingId(null)}
                    className="px-2 py-1 bg-white border border-[#E9E9E6] hover:bg-gray-50 text-gray-600 rounded-md text-[11px] font-bold"
                  >
                    ← 목록
                  </button>
                  <p className="text-[11px] font-black text-gray-800 truncate">
                    {visitingTank.ownerName || '이름 없는 선생님'}의 어항
                  </p>
                </div>
                <TankScene tank={visitingTank} height={200} interactive={false} />
                <div className="flex flex-wrap gap-1">
                  {Object.values(visitingTank.fish || {}).map((f) => (
                    <span key={f.id} className="px-2 py-0.5 bg-[#F7F7F5] border border-[#E9E9E6] rounded-md text-[10px] font-bold text-gray-600">
                      {f.name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  선생님들의 어항 ({otherTanks.length})
                </p>
                {otherTanks.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    <Sparkles className="w-5 h-5 mx-auto mb-1.5 opacity-50" />
                    <p className="text-[11px] font-bold">아직 다른 선생님의 어항이 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                    {otherTanks.map((t) => {
                      const count = Object.keys(t.fish || {}).length;
                      const bg = getBackground(t.bgId);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setVisitingId(t.id)}
                          className="w-full flex items-center gap-2.5 p-2 border border-[#E9E9E6] bg-white hover:border-sky-300 rounded-lg transition-all"
                        >
                          <span
                            className="w-14 h-10 rounded-md shrink-0 border border-white/70"
                            style={{ background: `linear-gradient(180deg, ${bg.sky}, ${bg.mid} 55%, ${bg.deep})` }}
                          />
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-[11px] font-black text-gray-800 truncate">
                              {t.ownerName || '이름 없는 선생님'}
                            </p>
                            <p className="text-[10px] text-gray-400 font-semibold">물고기 {count}마리</p>
                          </div>
                          <span className="shrink-0 px-2 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-md text-[10px] font-black">
                            구경하기
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {!myTeacherName && (
                  <p className="text-[10px] text-gray-400 font-semibold leading-relaxed bg-[#F7F7F5] border border-[#E9E9E6] rounded-md p-2">
                    상단 설정에서 이름을 등록하면 다른 선생님께 내 어항 주인 이름이 표시됩니다.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
