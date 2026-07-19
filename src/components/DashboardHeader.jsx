// src/components/DashboardHeader.jsx
import React from 'react';
import { Calendar as CalendarIcon, Pin, Lock, Unlock, Eye, Minus, Square, X } from 'lucide-react';

export default function DashboardHeader({
  syncStatus, isAlwaysOnTop, isMoveLocked, opacityValue, isOpacityDropdownOpen,
  setIsOpacityDropdownOpen, handleToggleAlwaysOnTop, handleToggleMoveLock,
  handleOpacityChange, handleMinimize, handleMaximize, handleClose
}) {
  return (
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
        <button type="button" onClick={handleToggleAlwaysOnTop} className={`p-1.5 rounded-md transition-colors ${isAlwaysOnTop ? 'bg-rose-50 text-rose-600 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}><Pin className={`w-4 h-4 ${isAlwaysOnTop ? 'rotate-45 fill-current' : ''}`} /></button>
        <button type="button" onClick={handleToggleMoveLock} className={`p-1.5 rounded-md transition-colors ${isMoveLocked ? 'bg-amber-50 text-amber-600 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>{isMoveLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}</button>
        <div className="relative">
          <button type="button" onClick={() => setIsOpacityDropdownOpen(!isOpacityDropdownOpen)} className={`p-1.5 rounded-md transition-colors ${opacityValue < 1.0 ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}><Eye className="w-4 h-4" /></button>
          {isOpacityDropdownOpen && (
            <div className="absolute right-0 mt-2 bg-white border border-[#E9E9E6] p-3 rounded-lg shadow-xl z-50 w-44 flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-bold text-gray-500"><span>투명도 조절</span><span>{Math.round(opacityValue * 100)}%</span></div>
              <input type="range" min="0.2" max="1.0" step="0.05" value={opacityValue} onChange={(e) => handleOpacityChange(e.target.value)} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-700" />
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
  );
}