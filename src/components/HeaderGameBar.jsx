// src/components/HeaderGameBar.jsx
// 헤더 미니게임 + 공유 순위표 (사람당 최고 기록 1개, 초기화 없음)
// 🔑 순위표 구독은 게임을 펼쳤을 때(이 컴포넌트가 마운트됐을 때)만 동작
import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { collection, doc, onSnapshot, query, orderBy, limit, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import HeaderMiniGame from './HeaderMiniGame';

const APP_ID = 'notion-school-calendar'; // App.jsx의 appId와 같아야 함
const NAME_KEY = 'dinoPlayerName';
const MEDALS = ['🥇', '🥈', '🥉'];
const scoresRef = () => collection(db, 'artifacts', APP_ID, 'public', 'data', 'dinoScores');
const pad = (n) => String(n).padStart(5, '0');
// 문서 id로 쓰이므로 '/' 제거, '.', '..'은 불가
const cleanName = (v) => v.replace(/\//g, '').trim().slice(0, 12);
const isValidName = (n) => !!n && !/^\.{1,2}$/.test(n);

export default function HeaderGameBar({ isOnline }) {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [ranking, setRanking] = useState([]);
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [isNameOpen, setIsNameOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [pendingScore, setPendingScore] = useState(null); // 이름 정하기 전에 나온 기록

  // 순위표 TOP 10 실시간 구독
  useEffect(() => {
    if (!isOnline) return;
    const q = query(scoresRef(), orderBy('score', 'desc'), limit(10));
    return onSnapshot(
      q,
      (snap) => setRanking(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('순위표 불러오기 실패:', err)
    );
  }, [isOnline]);

  // 🔑 서버의 내 최고 기록보다 높을 때만 저장 (여러 PC 동시 등록에도 안전하도록 트랜잭션)
  const submitScore = async (name, score) => {
    if (!isOnline || !isValidName(name) || score <= 0) return;
    const ref = doc(scoresRef(), name);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists() && (snap.data().score || 0) >= score) return;
        tx.set(ref, { name, score, updatedAt: new Date().toISOString() });
      });
    } catch (err) {
      console.error('기록 등록 실패:', err);
    }
  };

  const handleGameOver = (score) => {
    if (!isOnline || score <= 0) return;
    if (playerName) {
      submitScore(playerName, score);
      return;
    }
    // 이름이 아직 없으면 입력창 표시 (입력하는 동안 또 한 판 하면 더 높은 기록을 보관)
    setPendingScore((prev) => Math.max(prev ?? 0, score));
    setNameInput((prev) => prev || localStorage.getItem('my_teacher_name') || '');
    setIsBoardOpen(false);
    setIsNameOpen(true);
  };

  const openNameEdit = () => {
    setNameInput(playerName || localStorage.getItem('my_teacher_name') || '');
    setIsBoardOpen(false);
    setIsNameOpen(true);
  };

  const handleSaveName = () => {
    const name = cleanName(nameInput);
    if (!isValidName(name)) return;
    localStorage.setItem(NAME_KEY, name);
    setPlayerName(name);
    if (pendingScore) submitScore(name, pendingScore);
    setPendingScore(null);
    setIsNameOpen(false);
  };

  return (
    <div className="relative flex-1 min-w-0 flex items-center gap-1">
      <div className="flex-1 min-w-0">
        <HeaderMiniGame autoFocus onGameOver={handleGameOver} />
      </div>

      <button
        type="button"
        onClick={() => { setIsBoardOpen(!isBoardOpen); setIsNameOpen(false); }}
        className={`p-1 rounded-md cursor-pointer shrink-0 transition-colors ${isBoardOpen ? 'bg-amber-50 text-amber-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
        title="순위표"
      >
        <Trophy className="w-3.5 h-3.5" />
      </button>

      {/* 이름 입력 팝업 */}
      {isNameOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-[#E9E9E6] rounded-lg shadow-xl z-50 p-3 space-y-2">
          <p className="text-xs font-bold text-gray-800">순위표에 쓸 이름</p>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            {pendingScore ? `${pendingScore}점 기록을 이 이름으로 등록해요. ` : ''}
            한 번 정하면 이후 기록은 자동으로 등록됩니다.
          </p>
          <input
            autoFocus
            maxLength={12}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName();
              if (e.key === 'Escape') setIsNameOpen(false);
            }}
            placeholder="이름 (최대 12자)"
            className="w-full p-2 border border-[#E9E9E6] rounded text-xs bg-[#F7F7F5] focus:outline-none"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => { setIsNameOpen(false); setPendingScore(null); }}
              className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-bold cursor-pointer"
            >
              나중에
            </button>
            <button
              type="button"
              onClick={handleSaveName}
              disabled={!isValidName(cleanName(nameInput))}
              className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white rounded text-xs font-bold cursor-pointer"
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 순위표 팝업 */}
      {isBoardOpen && (
        <div className="absolute top-full right-0 mt-2 w-60 bg-white border border-[#E9E9E6] rounded-lg shadow-xl z-50 p-3">
          <p className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-500" /> 교무실 순위 TOP 10
          </p>

          {!isOnline ? (
            <p className="text-[11px] text-gray-400 text-center py-3">오프라인 모드에서는 순위표를 볼 수 없어요.</p>
          ) : ranking.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-3">아직 기록이 없어요. 첫 기록을 세워보세요!</p>
          ) : (
            <ol className="space-y-0.5">
              {ranking.map((r, i) => (
                <li
                  key={r.id}
                  className={`flex items-center justify-between text-xs px-1.5 py-1 rounded ${r.id === playerName ? 'bg-amber-50 font-bold text-amber-800' : 'text-gray-700'}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-5 text-center text-gray-400 font-mono shrink-0">{MEDALS[i] || i + 1}</span>
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="font-mono shrink-0">{pad(r.score)}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-2 pt-2 border-t border-[#E9E9E6] flex items-center justify-between text-[11px] text-gray-500">
            <span className="truncate">{playerName ? `내 이름: ${playerName}` : '이름 미등록'}</span>
            <button
              type="button"
              onClick={openNameEdit}
              className="text-amber-600 font-bold hover:underline shrink-0 cursor-pointer"
            >
              {playerName ? '변경' : '등록'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}