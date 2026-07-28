const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

app.disableHardwareAcceleration(); // 🔑 GPU 가속 비활성화

let win;

function createWindow() {
  const preloadPath = path.resolve(__dirname, 'preload.js');

  win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      sandbox: true,
      webviewTag: false,
      allowRunningInsecureContent: false
    },
  });

  // 🔑 처음엔 일반 크기로 띄우고, 최대화를 강제하지 않음
  win.once('ready-to-show', () => {
    win.show();
  });

  if (app.isPackaged) {
    // 🔑 네트워크 캐시(HTML/JS/CSS)만 비우고 localStorage(북마크, API 키 등)는 보존
    win.webContents.session.clearCache().then(() => {
      win.loadURL('https://grade-calendar-89b7c.web.app');
      win.webContents.openDevTools(); // 🔑 [임시 디버깅용] 확인 후 반드시 제거
    });
  } else {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  }
}

ipcMain.on('window-minimize', () => { if (win) win.minimize(); });

// 🔑 setBounds 우회 없이 네이티브 API만 사용 → Windows 네이티브 상태와 항상 일치
ipcMain.on('window-maximize', () => {
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on('window-close', () => { if (win) win.close(); });
ipcMain.on('set-always-on-top', (event, flag) => { if (win) win.setAlwaysOnTop(flag); });
ipcMain.on('set-movable', (event, flag) => { if (win) win.setMovable(flag); });

ipcMain.on('set-opacity', (event, value) => {
  if (win) {
    const opacityNum = typeof value === 'number' ? value : parseFloat(value);
    if (!isNaN(opacityNum) && opacityNum >= 0.2 && opacityNum <= 1.0) {
      win.setOpacity(opacityNum);
    }
  }
});

ipcMain.on('open-external', (event, url) => { shell.openExternal(url); });
ipcMain.handle('get-app-version', () => app.getVersion());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  console.log('app.isPackaged 값:', app.isPackaged); // 🔑 [임시 디버깅용]

   // 🔑 [신규] 패키징된 앱에서만 자동 업데이트 체크 (개발 모드에서는 동작 안 함)
  if (app.isPackaged) {
    autoUpdater.autoDownload = false; // 🔑 감지 즉시 자동 다운로드하지 않고, 사용자 확인 후 다운로드
    autoUpdater.checkForUpdates();
  }
});

// 🔑 [신규] 새 버전을 발견한 즉시(다운로드 전) 먼저 사용자에게 안내하고, 동의하면 다운로드 시작
autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: '업데이트 확인',
    message: `새 버전(${info.version})이 있습니다. 지금 업데이트를 받을까요?`,
    buttons: ['업데이트', '나중에'],
    defaultId: 0,
  }).then((result) => {
    if (result.response === 0) autoUpdater.downloadUpdate();
  });
});

// 🔑 [신규] 다운로드가 다 끝나면, 재시작해서 적용할지 물어봄
autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: '업데이트 준비 완료',
    message: '새 버전이 다운로드되었습니다. 지금 재시작해서 적용할까요?',
    buttons: ['지금 재시작', '나중에'],
    defaultId: 0,
  }).then((result) => {
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});