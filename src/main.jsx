import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import MyClassMini from './components/MyClassMini.jsx'

// 🔑 [신규] #myclass 해시로 열린 창은 "내 수업 미니 창"만 렌더 (본체 UI는 로드하지 않음)
const isMyClassMini = window.location.hash.startsWith('#myclass');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isMyClassMini ? <MyClassMini /> : <App />}
  </StrictMode>,
)

// 🔑 [신규] 서비스워커 등록 — 웹(https)에서만. Electron(file://)에서는 건너뜀
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[SW] 등록 실패:', err);
    });
  });
}
