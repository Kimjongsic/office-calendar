// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag),
  setMovable: (flag) => ipcRenderer.send('set-movable', flag),
  setOpacity: (value) => ipcRenderer.send('set-opacity', value),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  
  // 🔗 [오류 수정] 리액트 초기 구동 시 호출되는 전체화면(최대화) 명령 통로 신설
  setFullScreen: (flag) => ipcRenderer.send('set-fullscreen', flag) 
});