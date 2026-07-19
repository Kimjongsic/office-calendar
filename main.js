const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

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
    win.loadURL('https://grade-calendar-89b7c.web.app');
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

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});