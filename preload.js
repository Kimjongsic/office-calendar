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
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  startUpdateDownload: () => ipcRenderer.send('start-update-download'),
  quitAndInstallUpdate: () => ipcRenderer.send('quit-and-install-update'),
  onUpdateStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener); // 클린업용
  },
});