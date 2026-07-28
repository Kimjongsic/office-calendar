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

   // 🔑 [신규] 패키징된 앱에서만 자동 업데이트 체크. 팝업 없이 조용히 확인만 하고,
  // 결과는 렌더러(React)로 전달해서 헤더 알림 아이콘으로 표시함
  if (app.isPackaged) {
    autoUpdater.autoDownload = false;
    autoUpdater.checkForUpdates();
  }
});

// 🔑 새 버전 발견 시 다이얼로그 대신 렌더러로 정보만 조용히 전달
autoUpdater.on('update-available', (info) => {
  if (win) win.webContents.send('update-status', { status: 'available', version: info.version });
});

autoUpdater.on('update-not-available', () => {
  if (win) win.webContents.send('update-status', { status: 'not-available' });
});

autoUpdater.on('download-progress', (progress) => {
  if (win) win.webContents.send('update-status', { status: 'downloading', percent: Math.round(progress.percent) });
});

autoUpdater.on('update-downloaded', (info) => {
  if (win) win.webContents.send('update-status', { status: 'downloaded', version: info.version });
});

autoUpdater.on('error', (err) => {
  if (win) win.webContents.send('update-status', { status: 'error', message: err.message });
});

// 🔑 렌더러(모달의 "업데이트" 버튼)에서 요청할 때만 실제 다운로드 시작
ipcMain.on('start-update-download', () => {
  autoUpdater.downloadUpdate();
});

// 🔑 렌더러(모달의 "재시작" 버튼)에서 요청할 때 설치 후 재시작
ipcMain.on('quit-and-install-update', () => {
  autoUpdater.quitAndInstall();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});