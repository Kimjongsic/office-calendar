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
  savePageAsPdf: (defaultFileName, contentSizePx) => ipcRenderer.invoke('save-page-as-pdf', defaultFileName, contentSizePx),
  googleConnect: () => ipcRenderer.invoke('google-connect'),
  googleGetAccount: () => ipcRenderer.invoke('google-get-account'),
  googleDisconnect: () => ipcRenderer.invoke('google-disconnect'),
  googleListEvents: (range) => ipcRenderer.invoke('google-list-events', range),
  googleCreateEvent: (eventData) => ipcRenderer.invoke('google-create-event', eventData),
  googleUpdateEvent: (payload) => ipcRenderer.invoke('google-update-event', payload),
  googleDeleteEvent: (eventId) => ipcRenderer.invoke('google-delete-event', eventId),
  onUpdateStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener); // 클린업용
  },
});