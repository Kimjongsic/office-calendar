// src/components/HeaderMiniGame.jsx
// 헤더용 가로형 미니게임 (크롬 공룡 스타일)
// 🔑 60fps 루프는 React state를 쓰지 않고 ref + canvas로만 처리 (리렌더링 0회)
// 🔑 게임 중일 때만 requestAnimationFrame이 돌고, 대기/게임오버 상태에선 루프 정지 → CPU 사용 없음
import React, { useEffect, useRef } from 'react';

const H = 44;            // 캔버스 높이(px)
const GROUND_Y = 40;     // 땅 위치
const DINO_X = 16;
const DINO_W = 14;
const DINO_H = 16;
const GRAVITY = 1500;    // px/s²
const JUMP_V = 260;      // 최대 점프 높이 약 22px (캔버스 높이에 맞춤)
const START_SPEED = 220; // px/s
const MAX_SPEED = 520;
const HI_KEY = 'headerDinoHi';
const INK = '#535353';
const SUB = '#B4B4B0';
const DUCK_W = 18;
const DUCK_H = 10;
const BIRD_W = 14;
const BIRD_H = 8;
const BIRD_TOP = GROUND_Y - 19;  // 서 있으면 머리에 닿고, 숙이면 지나가는 높이
const BIRD_SCORE = 500;          // 이 점수부터 익룡 등장 (약 18초)

// 공룡 픽셀 (14 x 13) + 다리 3줄
const DINO_BODY = [
  '........######',
  '.......##.####',
  '.......#######',
  '.......#######',
  '.......####...',
  '.......#####..',
  '#.....####....',
  '#....######...',
  '##..#######...',
  '#########.....',
  '.########.....',
  '..#######.....',
  '...#####......',
];
const LEGS_STAND = ['...##.##......', '...#...#......', '...##..##.....'];
const LEGS_A = ['...##.##......', '...#..##......', '...##.........'];
const LEGS_B = ['...##.##......', '...##..#......', '.......##.....'];

// 숙인 공룡 (18 x 7) + 다리 3줄
const DUCK_BODY = [
  '............######',
  '#...........#.####',
  '##..##############',
  '##################',
  '.#############....',
  '..###########.....',
  '...########.......',
];
const DUCK_LEGS_A = ['...##..##.........', '...#....##........', '...##.............'];
const DUCK_LEGS_B = ['...##..##.........', '...##....#........', '.........##.......'];

// 익룡 (14 x 8) 날갯짓 2프레임
const BIRD_UP = [
  '......##......',
  '......###.....',
  '..##..####....',
  '.###########..',
  '#####.########',
  '.......######.',
  '..............',
  '..............',
];
const BIRD_DOWN = [
  '..............',
  '..............',
  '..##..........',
  '.###########..',
  '#####.########',
  '......########',
  '......###.....',
  '......##......',
];

export default function HeaderMiniGame({ autoFocus = false, onGameOver }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const onGameOverRef = useRef(onGameOver); // 🔑 게임 루프 안에서 항상 최신 콜백을 부르기 위한 ref
  const g = useRef({
    state: 'idle', // idle | running | over
    y: 0,          // 땅 기준 높이 (0 = 땅)
    vy: 0,
    speed: START_SPEED,
    dist: 0,
    obstacles: [],
    spawnIn: 60,
    groundOffset: 0,
    duck: false,
    width: 0,
    hi: 0,
    overAt: 0,
    rafId: 0,
    lastT: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext('2d');
    const s = g.current;

    try { s.hi = Number(localStorage.getItem(HI_KEY) || 0); } catch { s.hi = 0; }

    function reset() {
      s.y = 0; s.vy = 0; s.duck = false;
      s.speed = START_SPEED;
      s.dist = 0;
      s.obstacles = [];
      s.spawnIn = 60;
    }

    function spawn() {
      const score = Math.floor(s.dist / 10);
      if (score >= BIRD_SCORE && Math.random() < 0.25) {
        s.obstacles.push({ type: 'bird', x: s.width + 4, w: BIRD_W, h: BIRD_H, top: BIRD_TOP });
        return;
      }
      const r = Math.random();
      let w, h;
      if (r < 0.45) { w = 6; h = 11; }       // 작은 선인장
      else if (r < 0.8) { w = 9; h = 14; }   // 큰 선인장
      else { w = 16; h = 11; }               // 작은 선인장 2개 묶음
      s.obstacles.push({ type: 'cactus', x: s.width + 4, w, h, top: GROUND_Y - h });
    }

    function gameOver() {
      s.state = 'over';
      s.overAt = performance.now();
      const score = Math.floor(s.dist / 10);
      if (score > s.hi) {
        s.hi = score;
        try { localStorage.setItem(HI_KEY, String(score)); } catch { /* 무시 */ }
      }
      onGameOverRef.current?.(score);
    }

    function update(dt) {
      s.speed = Math.min(MAX_SPEED, s.speed + 6 * dt);
      const move = s.speed * dt;
      s.dist += move;
      s.groundOffset = (s.groundOffset + move) % 24;

      // 점프 물리
      if (s.y > 0 || s.vy > 0) {
        const grav = s.duck ? GRAVITY * 3 : GRAVITY; // 공중에서 ↓ 누르면 빨리 떨어짐
        s.vy -= grav * dt;
        s.y += s.vy * dt;
        if (s.y <= 0) { s.y = 0; s.vy = 0; }
      }

      // 장애물 이동/생성
      s.obstacles.forEach((o) => { o.x -= move; });
      s.obstacles = s.obstacles.filter((o) => o.x + o.w > -4);
      s.spawnIn -= move;
      if (s.spawnIn <= 0) {
        spawn();
        s.spawnIn = s.speed * (0.65 + Math.random() * 0.9) + 40;
      }

      // 충돌 판정 (가장자리 2px 여유) — 숙이면 공룡이 낮고 길어짐
      const ducking = s.duck && s.y === 0;
      const dw = ducking ? DUCK_W : DINO_W;
      const dh = ducking ? DUCK_H : DINO_H;
      const dl = DINO_X + 2;
      const dr = DINO_X + dw - 2;
      const dTop = GROUND_Y - dh - s.y + 2;
      const dBottom = GROUND_Y - s.y - 2;
      for (const o of s.obstacles) {
        const oTop = o.top + 1;
        const oBottom = o.top + o.h - 1;
        if (dr > o.x + 1 && dl < o.x + o.w - 1 && dBottom > oTop && dTop < oBottom) {
          gameOver();
          break;
        }
      }
    }

    function drawPixels(rows, x0, y0) {
      rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] === '#') ctx.fillRect(x0 + c, y0 + r, 1, 1);
        }
      });
    }

    function drawDino(t) {
      const x0 = DINO_X;
      if (s.state === 'running' && s.duck && s.y === 0) {
        const dy = GROUND_Y - DUCK_H;
        const duckLegs = Math.floor(t / 100) % 2 === 0 ? DUCK_LEGS_A : DUCK_LEGS_B;
        ctx.fillStyle = INK;
        drawPixels(DUCK_BODY, x0, dy);
        drawPixels(duckLegs, x0, dy + DUCK_BODY.length);
        return;
      }
      const y0 = Math.round(GROUND_Y - DINO_H - s.y);
      let legs = LEGS_STAND;
      if (s.state === 'running' && s.y === 0) {
        legs = Math.floor(t / 100) % 2 === 0 ? LEGS_A : LEGS_B;
      }
      ctx.fillStyle = INK;
      drawPixels(DINO_BODY, x0, y0);
      drawPixels(legs, x0, y0 + DINO_BODY.length);
    }

    function cactus(x, w, h) {
      const top = GROUND_Y - h;
      const tw = Math.max(2, Math.round(w / 3));   // 몸통 굵기
      const cx = x + Math.floor((w - tw) / 2);
      const armH = Math.round(h / 3);
      ctx.fillRect(cx, top, tw, h);                           // 몸통
      ctx.fillRect(x, top + 3, 1, armH);                      // 왼팔
      ctx.fillRect(x, top + 3 + armH, cx - x, 1);
      ctx.fillRect(x + w - 1, top + 2, 1, armH);              // 오른팔
      ctx.fillRect(cx + tw, top + 2 + armH, x + w - (cx + tw), 1);
    }

    function drawCactus(o) {
      if (o.w >= 16) {
        cactus(Math.round(o.x), 6, o.h);
        cactus(Math.round(o.x) + 9, 6, o.h - 2);
      } else {
        cactus(Math.round(o.x), o.w, o.h);
      }
    }

    function drawBird(o, t) {
      const frame = Math.floor(t / 150) % 2 === 0 ? BIRD_UP : BIRD_DOWN;
      drawPixels(frame, Math.round(o.x), o.top);
    }

    function draw(t) {
      const W = s.width;
      ctx.clearRect(0, 0, W, H);
      if (W < 100) return;

      // 땅
      ctx.fillStyle = SUB;
      ctx.fillRect(0, GROUND_Y, W, 1);
      for (let x = -s.groundOffset; x < W; x += 24) {
        ctx.fillRect(Math.round(x) + 5, GROUND_Y + 3, 2, 1);
        ctx.fillRect(Math.round(x) + 15, GROUND_Y + 2, 1, 1);
      }

      // 선인장 + 공룡
      ctx.fillStyle = INK;
      s.obstacles.forEach((o) => (o.type === 'bird' ? drawBird(o, t) : drawCactus(o)));
      drawDino(t);

      // 점수
      const pad = (n) => String(n).padStart(5, '0');
      ctx.font = '10px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = SUB;
      ctx.fillText(`HI ${pad(s.hi)}`, W - 52, 4);
      ctx.fillStyle = INK;
      ctx.fillText(pad(Math.floor(s.dist / 10)), W - 6, 4);

      // 안내 문구
      if (s.state !== 'running') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 11px Pretendard, "Malgun Gothic", sans-serif';
        ctx.fillStyle = s.state === 'over' ? INK : '#9B9A97';
        ctx.fillText(
          s.state === 'over' ? 'GAME OVER · 클릭해서 다시' : '클릭·스페이스로 시작 · ↓ 숙이기',
          W / 2, 20
        );
      }
    }

    function loop(t) {
      const dt = Math.min(0.05, (t - s.lastT) / 1000); // 창 최소화 후 복귀 시 순간이동 방지
      s.lastT = t;
      update(dt);
      draw(t);
      if (s.state === 'running') s.rafId = requestAnimationFrame(loop);
    }

    function press() {
      const now = performance.now();
      if (s.state === 'over' && now - s.overAt < 400) return; // 죽자마자 연타로 재시작되는 것 방지
      if (s.state !== 'running') {
        reset();
        s.state = 'running';
        s.lastT = now;
        cancelAnimationFrame(s.rafId);
        s.rafId = requestAnimationFrame(loop);
      }
      if (!s.duck && s.y === 0 && s.vy === 0) s.vy = JUMP_V;
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      s.width = wrap.clientWidth;
      canvas.width = Math.round(s.width * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${s.width}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }

    // 🔑 스페이스/↑는 캔버스에 포커스가 있을 때만 → 일정 입력창 타이핑과 충돌하지 않음
    const onPointer = (e) => { e.preventDefault(); canvas.focus(); press(); };
    const onKey = (e) => {
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (s.state === 'running') s.duck = true;
        return;
      }
      if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
      e.preventDefault();
      if (e.repeat && s.state !== 'running') return;
      press();
    };
    const onKeyUp = (e) => { if (e.code === 'ArrowDown') s.duck = false; };
    const onBlur = () => { s.duck = false; };

    canvas.addEventListener('pointerdown', onPointer);
    canvas.addEventListener('keydown', onKey);
    canvas.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('blur', onBlur);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    return () => {
      cancelAnimationFrame(s.rafId);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointer);
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('blur', onBlur);
    };
  }, []);

  // 🔑 헤더에서 펼치자마자 스페이스로 바로 시작할 수 있도록 포커스
  useEffect(() => {
    if (autoFocus) canvasRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  return (
    <div ref={wrapRef} className="w-full" style={{ height: H }}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="block outline-none cursor-pointer"
        title="미니게임: 클릭 또는 스페이스로 점프"
      />
    </div>
  );
}