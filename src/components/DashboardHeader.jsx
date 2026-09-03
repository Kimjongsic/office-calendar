// src/components/DashboardHeader.jsx
import React from 'react';
import { Calendar as CalendarIcon, Pin, Lock, Unlock, Eye, Minus, Square, X, Bell, Download, RefreshCw, PartyPopper, Power, PowerOff } from 'lucide-react';

export default function DashboardHeader({
  syncStatus, isAlwaysOnTop, isMoveLocked, opacityValue, isOpacityDropdownOpen,
  setIsOpacityDropdownOpen, handleToggleAlwaysOnTop, handleToggleMoveLock,
  handleOpacityChange, handleMinimize, handleMaximize, handleClose, appVersion,
  updateInfo, isUpdateModalOpen, setIsUpdateModalOpen, handleStartUpdateDownload, handleQuitAndInstall,
  isAutoLaunchOn, handleToggleAutoLaunch, scheduledShutdownAt
}) {
  const hasUpdateAvailable = updateInfo.status === 'available' || updateInfo.status === 'downloading' || updateInfo.status === 'downloaded';
  // 🔑 electronAPI 직접 호출 제거: IPC 호출은 App.jsx의 handleX 함수들이 이미 담당하고 있어서
  // 여기서 또 호출하면 클릭 한 번에 IPC가 두 번 전송되어(최대화→즉시 복원) 버튼이
  // 안 먹히는 것처럼 보이는 버그가 발생했음. prop으로 받은 핸들러만 그대로 사용.

  return (
    <header 
      className="bg-white border-b border-[#E9E9E6] px-6 py-3 sticky top-0 z-40 shadow-xs flex items-center justify-between select-none"
      style={{ WebkitAppRegion: isMoveLocked ? 'no-drag' : 'drag' }}
    >
      {/* 좌측 타이틀 영역 */}
      <div 
        className="flex items-center gap-4 shrink-0"
        style={{ WebkitAppRegion: isMoveLocked ? 'no-drag' : 'drag' }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#F7F7F5] border border-[#E9E9E6] rounded-md">
            <CalendarIcon className="w-5 h-5 text-[#37352F]" />
          </div>
          <div>
            <h1 className="text-base font-black flex items-center gap-2">
              교무실 공유 캘린더
              {isMoveLocked && <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">위치 잠김</span>}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              2026년 솔내고 2학년실
              {appVersion && <span className="ml-1 text-gray-300">· v{appVersion}</span>}
            </p>
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

        {/* 🔑 [신규] 예약 종료가 걸려있으면 헤더에 표시 */}
        {scheduledShutdownAt && (() => {
          const target = new Date(scheduledShutdownAt);
          const pad = (n) => String(n).padStart(2, '0');
          return (
            <div className="flex items-center gap-1.5 text-xs bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-full font-medium">
              <PowerOff className="w-3 h-3 text-rose-600" />
              <span className="text-rose-700 font-semibold">{pad(target.getHours())}:{pad(target.getMinutes())}에 종료 예약</span>
            </div>
          );
        })()}
      </div>

      {/* 우측 버튼 그룹 영역 */}
      <div 
        className="flex items-center gap-1 shrink-0 relative z-50"
        style={{ WebkitAppRegion: 'no-drag', appRegion: 'no-drag' }}
      >
        {/* 🔑 [신규] 컴퓨터 시작 시 자동 실행 버튼 */}
        <button 
          type="button" 
          onClick={handleToggleAutoLaunch} 
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${isAutoLaunchOn ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
          title={isAutoLaunchOn ? "컴퓨터 시작 시 자동 실행: 켜짐" : "컴퓨터 시작 시 자동 실행: 꺼짐"}
        >
          <Power className="w-4 h-4" />
        </button>

        {/* 항상 위에 표시 버튼 */}
        <button 
          type="button" 
          onClick={handleToggleAlwaysOnTop} 
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${isAlwaysOnTop ? 'bg-rose-50 text-rose-600 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
          title="항상 위에 표시"
        >
          <Pin className={`w-4 h-4 ${isAlwaysOnTop ? 'rotate-45 fill-current' : ''}`} />
        </button>
        
        {/* 창 이동 잠금/해제 버튼 */}
        <button 
          type="button" 
          onClick={handleToggleMoveLock} 
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${isMoveLocked ? 'bg-amber-50 text-amber-600 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
          title={isMoveLocked ? "창 이동 잠금 활성화" : "창 이동 허용"}
        >
          {isMoveLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
        
        {/* 창 투명도 드롭다운 */}
        <div className="relative">
          <button 
            type="button" 
            onClick={() => setIsOpacityDropdownOpen(!isOpacityDropdownOpen)} 
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${opacityValue < 1.0 ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
            title="창 투명도 설정"
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
                type="range" 
                min="0.2" 
                max="1.0" 
                step="0.05" 
                value={opacityValue} 
                onChange={(e) => handleOpacityChange(e.target.value)} 
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-700" 
              />
              <button 
                onClick={() => setIsOpacityDropdownOpen(false)} 
                className="mt-1 text-[10px] text-center bg-gray-100 text-gray-600 py-1 rounded font-bold hover:bg-gray-200 cursor-pointer"
              >
                설정 완료
              </button>
            </div>
          )}
        </div>
        
        {/* 🔑 [신규] 업데이트 알림 종 아이콘 */}
        <div className="relative">
          <button 
            type="button"
            onClick={() => setIsUpdateModalOpen(!isUpdateModalOpen)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${hasUpdateAvailable ? 'text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:bg-gray-100'}`}
            title={hasUpdateAvailable ? '새 업데이트가 있습니다' : '업데이트 없음'}
          >
            <Bell className="w-4 h-4" />
            {hasUpdateAvailable && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
            )}
          </button>

          {isUpdateModalOpen && (
            <div className="absolute right-0 mt-2 bg-white border border-[#E9E9E6] p-4 rounded-lg shadow-xl z-50 w-64 space-y-3">
              {updateInfo.status === 'available' && (
                <>
                  <div className="flex items-center gap-2 text-amber-700">
                    <Download className="w-4 h-4" />
                    <p className="text-xs font-bold">새 버전 {updateInfo.version} 발견</p>
                  </div>
                  {updateInfo.releaseNotes && (
                    <div 
                      className="text-[11px] text-gray-600 bg-[#F7F7F5] border border-[#E9E9E6] rounded-md p-2 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }}
                    />
                  )}
                  <p className="text-[11px] text-gray-500">업데이트를 받으시겠어요?</p>
                  <button onClick={handleStartUpdateDownload} className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold">업데이트 받기</button>
                </>
              )}

              {updateInfo.status === 'downloading' && (
                <>
                  <div className="flex items-center gap-2 text-amber-700">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <p className="text-xs font-bold">다운로드 중... {updateInfo.percent ?? 0}%</p>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 transition-all" style={{ width: `${updateInfo.percent ?? 0}%` }}></div>
                  </div>
                </>
              )}

              {updateInfo.status === 'downloaded' && (
                <>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <PartyPopper className="w-4 h-4" />
                    <p className="text-xs font-bold">버전 {updateInfo.version} 준비 완료</p>
                  </div>
                  {updateInfo.releaseNotes && (
                    <div 
                      className="text-[11px] text-gray-600 bg-[#F7F7F5] border border-[#E9E9E6] rounded-md p-2 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }}
                    />
                  )}
                  <p className="text-[11px] text-gray-500">지금 재시작해서 적용할까요?</p>
                  <button onClick={handleQuitAndInstall} className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold">지금 재시작</button>
                </>
              )}

              {updateInfo.status === 'not-available' && (
                <p className="text-[11px] text-gray-400 text-center py-2">이미 최신 버전을 사용 중입니다.</p>
              )}

              {updateInfo.status === 'error' && (
                <p className="text-[11px] text-rose-500 text-center py-2">업데이트 확인 중 오류가 발생했습니다.</p>
              )}

              {updateInfo.status === 'idle' && (
                <p className="text-[11px] text-gray-400 text-center py-2">업데이트 확인 중...</p>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-gray-300 mx-1"></div>
        
        <button onClick={handleMinimize} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-800 rounded-md cursor-pointer" title="최소화"><Minus className="w-3.5 h-3.5" /></button>
        <button onClick={handleMaximize} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-800 rounded-md cursor-pointer" title="최대화"><Square className="w-3 h-3" /></button>
        <button onClick={handleClose} className="p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 rounded-md cursor-pointer" title="닫기"><X className="w-3.5 h-3.5" /></button>
      </div>
    </header>
  );
}