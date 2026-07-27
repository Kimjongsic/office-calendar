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
  console.log('클릭 전:', win.isMaximized(), win.getBounds());
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
  console.log('클릭 후:', win.isMaximized(), win.getBounds());
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

  // 🔑 [신규] 패키징된 앱에서만 자동 업데이트 체크 (개발 모드에서는 동작 안 함)
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

// 🔑 [신규] 새 버전이 백그라운드에 다 받아지면, 사용자에게 재시작해서 적용할지 물어봄
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