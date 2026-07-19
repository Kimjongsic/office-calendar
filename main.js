const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    frame: false, // OS 기본 타이틀바/테두리 제거 유지
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // 💡 app.getAppPath()를 사용하여 빌드 및 패키징 후에도 preload.js 경로를 정확하게 찾아내도록 수정했습니다.
      preload: path.join(app.getAppPath(), 'preload.js') 
    },
  });

  win.maximize();

  win.show();

  win.loadFile(path.join(__dirname, 'dist/index.html'));
  
  // 🛠️ 만약 이래도 화면이 안 나온다면 아래 주석(//)을 풀고 실행해 보세요. 
  // 개발자 도구 콘솔창이 열리면서 정확히 어떤 경로에서 파일 로딩이 막혔는지 알려줍니다!
  win.webContents.openDevTools();
}

// 📡 React 프론트엔드 창 제어 IPC 이벤트 리스너 (기능 완벽 유지)
ipcMain.on('window-minimize', () => win.minimize());
ipcMain.on('window-maximize', () => {
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});
ipcMain.on('window-close', () => win.close());
ipcMain.on('set-always-on-top', (event, flag) => {
  win.setAlwaysOnTop(flag, 'screen-saver');
});
ipcMain.on('set-movable', (event, flag) => {
  win.setMovable(flag);
});
ipcMain.on('set-opacity', (event, opacityValue) => {
  win.setOpacity(parseFloat(opacityValue));
});

// 🌐 [기능 추가] 북마크 클릭 시 일렉트론 창이 아닌 실제 크롬/엣지로 주소를 쏘아주는 핸들러
ipcMain.on('open-external', (event, url) => {
  if (url) {
    shell.openExternal(url); // 👈 시스템 작업표시줄 및 크롬 브라우저를 새 창으로 호출
  }
});

// 📡 리액트의 setFullScreen 요청을 작업표시줄 유지형 'maximize'로 치환하여 처리
ipcMain.on('set-fullscreen', (event, flag) => {
  if (flag && win) {
    win.maximize(); // 작업표시줄을 가리지 않고 화면에 꽉 채웁니다.
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});