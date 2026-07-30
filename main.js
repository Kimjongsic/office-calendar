const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { autoUpdater } = require('electron-updater');
const { google } = require('googleapis');
const Store = require('electron-store').default;
const http = require('http');

// 🔑 구글 캘린더 개인 연동 - 토큰은 이 PC에만 암호화 저장 (Firestore 전송 안 함)
const googleTokenStore = new Store({ name: 'google-calendar-tokens', encryptionKey: 'office-calendar-local-secret' });

const GOOGLE_REDIRECT_PORT = 53682;
const GOOGLE_REDIRECT_URI = `http://localhost:${GOOGLE_REDIRECT_PORT}/oauth-callback`;

function createGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

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

// 🔑 구글 계정 연결 시작: 시스템 브라우저로 로그인 창을 열고, 로컬 서버로 인증 코드를 받음
ipcMain.handle('google-connect', () => {
  return new Promise((resolve, reject) => {
    const oAuth2Client = createGoogleOAuthClient();
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline', // refresh token을 받기 위해 필수
      prompt: 'consent',      // 매번 동의 화면을 띄워서 refresh token을 확실히 받음
      scope: ['https://www.googleapis.com/auth/calendar'],
    });

    const server = http.createServer(async (req, res) => {
      if (!req.url.startsWith('/oauth-callback')) return;
      const urlObj = new URL(req.url, GOOGLE_REDIRECT_URI);
      const code = urlObj.searchParams.get('code');

      res.end('로그인이 완료되었습니다. 이 창은 닫으셔도 됩니다.');
      server.close();

      if (!code) {
        reject(new Error('인증 코드가 없습니다.'));
        return;
      }

      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
        const { data: profile } = await oauth2.userinfo.get();

        googleTokenStore.set('tokens', tokens);
        googleTokenStore.set('email', profile.email);
        resolve({ email: profile.email });
      } catch (err) {
        reject(err);
      }
    });

    server.listen(GOOGLE_REDIRECT_PORT, () => {
      shell.openExternal(authUrl); // 🔑 시스템 기본 브라우저로 열기 (Electron 내장 창 아님)
    });
  });
});

// 🔑 현재 연결된 구글 계정 정보 조회 (연결 안 돼있으면 null)
ipcMain.handle('google-get-account', () => {
  const email = googleTokenStore.get('email');
  return email ? { email } : null;
});

// 🔑 구글 계정 연결 해제
ipcMain.handle('google-disconnect', () => {
  googleTokenStore.clear();
  return true;
});

// 🔑 저장된 토큰으로 인증된 OAuth2 클라이언트를 만드는 헬퍼
function getAuthorizedGoogleClient() {
  const tokens = googleTokenStore.get('tokens');
  if (!tokens) return null;
  const oAuth2Client = createGoogleOAuthClient();
  oAuth2Client.setCredentials(tokens);
  oAuth2Client.on('tokens', (newTokens) => {
    // refresh token으로 access token이 자동 갱신되면 최신 토큰을 다시 저장
    googleTokenStore.set('tokens', { ...tokens, ...newTokens });
  });
  return oAuth2Client;
}

// 🔑 구글 캘린더 일정 목록 가져오기 (특정 기간)
ipcMain.handle('google-list-events', async (event, { timeMin, timeMax }) => {
  const auth = getAuthorizedGoogleClient();
  if (!auth) throw new Error('구글 계정이 연결되어 있지 않습니다.');
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return res.data.items || [];
});

// 🔑 구글 캘린더에 일정 추가
ipcMain.handle('google-create-event', async (event, eventData) => {
  const auth = getAuthorizedGoogleClient();
  if (!auth) throw new Error('구글 계정이 연결되어 있지 않습니다.');
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.insert({ calendarId: 'primary', requestBody: eventData });
  return res.data;
});

// 🔑 구글 캘린더 일정 수정
ipcMain.handle('google-update-event', async (event, { eventId, eventData }) => {
  const auth = getAuthorizedGoogleClient();
  if (!auth) throw new Error('구글 계정이 연결되어 있지 않습니다.');
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.update({ calendarId: 'primary', eventId, requestBody: eventData });
  return res.data;
});

// 🔑 구글 캘린더 일정 삭제
ipcMain.handle('google-delete-event', async (event, eventId) => {
  const auth = getAuthorizedGoogleClient();
  if (!auth) throw new Error('구글 계정이 연결되어 있지 않습니다.');
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({ calendarId: 'primary', eventId });
  return true;
});

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
  if (win) win.webContents.send('update-status', { status: 'available', version: info.version, releaseNotes: info.releaseNotes });
});

autoUpdater.on('update-not-available', () => {
  if (win) win.webContents.send('update-status', { status: 'not-available' });
});

autoUpdater.on('download-progress', (progress) => {
  if (win) win.webContents.send('update-status', { status: 'downloading', percent: Math.round(progress.percent) });
});

autoUpdater.on('update-downloaded', (info) => {
  if (win) win.webContents.send('update-status', { status: 'downloaded', version: info.version, releaseNotes: info.releaseNotes });
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