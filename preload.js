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
<<<<<<< HEAD
=======
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
>>>>>>> e9a225cc1ed8ba975b48fc5e3e2be29299ce89a1
  
});