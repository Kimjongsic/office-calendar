const { contextBridge, ipcRenderer } = require('electron');

// React 컴포넌트의 window.electronAPI 인터페이스를 안전하게 바인딩합니다.
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag),
  setMovable: (flag) => ipcRenderer.send('set-movable', flag),
  setOpacity: (value) => ipcRenderer.send('set-opacity', value)
});