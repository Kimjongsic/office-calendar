// src/components/InstallAppButton.jsx
import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, ExternalLink, Copy, Check as CheckIcon } from 'lucide-react';

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null); // 안드로이드용 설치 이벤트
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false); // 🔑 [신규] 인앱 브라우저 탈출용 주소 복사 완료 표시

  useEffect(() => {
    const ua = window.navigator.userAgent;

    // 🔑 아이폰/아이패드 판별 (iPadOS는 UA에 Macintosh로 위장하므로 터치 개수로 보정)
    const ios = /iPhone|iPad|iPod/i.test(ua) ||
      (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    setIsIos(ios);

    // 🔑 이미 홈 화면 앱으로 실행 중인지
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);

    // 🔑 카톡/메신저 인앱 브라우저는 홈 화면 추가가 불가능 → 별도 안내 필요
    setIsInAppBrowser(/KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line|DaumApps/i.test(ua));

    // 🔑 이번 세션에서 이미 닫았으면 다시 띄우지 않음
    if (sessionStorage.getItem('installBannerDismissed') === '1') setDismissed(true);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e); // 나중에 버튼 클릭 시 사용
    };
    const onInstalled = () => { setDeferredPrompt(null); setIsStandalone(true); };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('installBannerDismissed', '1');
  };

  // 🔑 [신규] 인앱 브라우저에서 기본 브라우저로 탈출
  const handleEscapeInApp = () => {
    const url = window.location.href;

    if (!isIos) {
      // ✅ 안드로이드: 인텐트 URL로 크롬을 직접 실행 (원탭 탈출)
      const bare = url.replace(/^https?:\/\//, '');
      window.location.href =
        `intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`;
      return;
    }

    // ⚠️ iOS: 외부 브라우저를 강제 실행할 방법이 없어 주소 복사만 지원
    navigator.clipboard?.writeText(url)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {
        // clipboard API가 막힌 경우 구식 방식으로 폴백
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { /* 무시 */ }
        document.body.removeChild(ta);
      });
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // ✅ 안드로이드 크롬: 진짜 원탭 설치
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
      return;
    }
    // ⚠️ iOS: 자동 설치 API가 없어 안내만 가능
    setShowIosGuide(true);
  };

  // 🔑 Electron 데스크톱 앱 안에서는 절대 표시하지 않음
  if (window.electronAPI) return null;
  // 🔑 이미 설치됐거나, 닫았거나, 설치 수단이 전혀 없으면 숨김
  if (isStandalone || dismissed) return null;
  // 🔑 [수정] 인앱 브라우저는 설치 수단이 없어도 "밖에서 열기" 안내를 위해 표시
  if (!deferredPrompt && !isIos && !isInAppBrowser) return null;

  return (
    <>
      {/* 🔑 하단 탭 막대 바로 위에 뜨는 설치 유도 알약 버튼 (모바일 전용) */}
      <div
        className="md:hidden fixed left-0 right-0 z-45 flex justify-center px-4 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 8px) + 60px)' }}
      >
        <div className="pointer-events-auto flex items-center gap-2 bg-[#37352F] text-white rounded-full shadow-lg pl-4 pr-2 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <button
            type="button"
            onClick={isInAppBrowser ? handleEscapeInApp : handleInstallClick}
            className="flex items-center gap-2 text-xs font-bold"
          >
            {isInAppBrowser ? (
              copied ? (
                <>
                  <CheckIcon className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>주소 복사됨! Safari에 붙여넣기</span>
                </>
              ) : (
                <>
                  {isIos ? <Copy className="w-4 h-4 shrink-0" /> : <ExternalLink className="w-4 h-4 shrink-0" />}
                  <span>{isIos ? '앱으로 설치하려면 여기를 탭' : '크롬으로 열어서 앱 설치'}</span>
                </>
              )
            ) : (
              <>
                <Download className="w-4 h-4 shrink-0" />
                <span>홈 화면에 앱으로 추가</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-white/60 hover:text-white rounded-full shrink-0"
            aria-label="닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 🔑 iOS 전용 안내 오버레이 — 하단 공유 버튼을 화살표로 가리킴 */}
      {showIosGuide && (
        <div
          className="md:hidden fixed inset-0 z-100 bg-black/60 backdrop-blur-xs flex flex-col justify-end p-5"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 space-y-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[#37352F]">아이폰 홈 화면에 추가하기</h3>
              <button type="button" onClick={() => setShowIosGuide(false)} className="p-1 text-gray-400 hover:text-gray-800 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

                        {isInAppBrowser ? (
              <div className="space-y-3">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs font-semibold text-rose-700 leading-relaxed">
                  지금은 카카오톡 같은 앱 안의 브라우저예요. 여기서는 홈 화면 추가가 불가능합니다.
                </div>
                <ol className="space-y-2.5">
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-[#37352F] text-white text-[10px] font-black flex items-center justify-center">1</span>
                    <p className="text-xs font-semibold text-gray-700 leading-relaxed">
                      화면 <span className="font-black">우측 하단 ···</span> → <span className="font-black">Safari로 열기</span><br />
                      <span className="text-[10px] text-gray-400 font-medium">메뉴가 안 보이면 아래 버튼으로 주소를 복사하세요</span>
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-[#37352F] text-white text-[10px] font-black flex items-center justify-center">2</span>
                    <p className="text-xs font-semibold text-gray-700 leading-relaxed">
                      Safari에서 열린 뒤, 다시 이 안내를 보고 홈 화면에 추가하세요
                    </p>
                  </li>
                </ol>
                <button
                  type="button"
                  onClick={handleEscapeInApp}
                  className="w-full py-2.5 bg-[#37352F] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2"
                >
                  {copied
                    ? <><CheckIcon className="w-4 h-4 text-emerald-400" /> 복사 완료! Safari 주소창에 붙여넣기</>
                    : <><Copy className="w-4 h-4" /> 주소 복사하기</>}
                </button>
              </div>
            ) : (
              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-[#37352F] text-white text-[10px] font-black flex items-center justify-center">1</span>
                  <p className="text-xs font-semibold text-gray-700 leading-relaxed flex items-center gap-1.5 flex-wrap">
                    화면 <span className="font-black">아래쪽 가운데</span>의 공유 버튼
                    <Share className="w-4 h-4 text-blue-600 inline" />
                    을 누르세요
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-[#37352F] text-white text-[10px] font-black flex items-center justify-center">2</span>
                  <p className="text-xs font-semibold text-gray-700 leading-relaxed flex items-center gap-1.5 flex-wrap">
                    메뉴를 내려서
                    <PlusSquare className="w-4 h-4 text-gray-800 inline" />
                    <span className="font-black">홈 화면에 추가</span>를 선택
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-[#37352F] text-white text-[10px] font-black flex items-center justify-center">3</span>
                  <p className="text-xs font-semibold text-gray-700 leading-relaxed">
                    오른쪽 위 <span className="font-black">추가</span>를 누르면 끝!
                  </p>
                </li>
              </ol>
            )}

            <p className="text-[10px] text-gray-400 font-medium leading-relaxed border-t border-gray-100 pt-3">
              애플 정책상 홈 화면 추가는 자동으로 실행할 수 없어, 직접 눌러주셔야 합니다.
            </p>
          </div>

          {/* 🔑 하단 공유 버튼 방향을 가리키는 화살표 */}
          {!isInAppBrowser && (
            <div className="flex justify-center pt-3 pb-1 animate-bounce">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>
      )}
    </>
  );
}