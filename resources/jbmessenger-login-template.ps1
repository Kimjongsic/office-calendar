[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic

# 🔑 [임시 디버깅용] 스크립트가 실제로 시작되는지 확인
$logPath = "$env:APPDATA\office-calendar\jbmessenger-login-log.txt"
Add-Content -Path $logPath -Value "$(Get-Date): 스크립트 시작됨"

# 0. 🔑 [수정] 무조건 10초 기다리는 대신, "로그인 화면(LogonUI)이 실제로 사라질 때까지" 대기
#    → 사용자가 아직 Windows 비밀번호를 입력 중이면 LogonUI.exe 프로세스가 살아있으므로,
#      그게 없어지는(=바탕화면에 실제로 도달한) 순간까지 최대 5분간 기다림
$maxLoginWaitSeconds = 300
$loginWaited = 0
while ((Get-Process -Name "LogonUI" -ErrorAction SilentlyContinue) -and ($loginWaited -lt $maxLoginWaitSeconds)) {
    Start-Sleep -Seconds 2
    $loginWaited += 2
}
# 🔑 로그인 완료 후에도 바탕화면이 안정화될 시간을 조금 더 확보
Start-Sleep -Seconds 5

# 🔑 [임시 디버깅용]
Add-Content -Path $logPath -Value "$(Get-Date): 로그인 대기 끝, 메신저 실행 시도"

# 1. JBEdu Messenger 실행
Start-Process "C:\Program Files (x86)\JBEdu Messenger+\Launcher.exe"

# 2. 🔑 [수정] 무조건 몇 초 기다리는 대신, 창(프로세스)이 실제로 뜰 때까지 최대 60초간 0.5초 간격으로 확인
$maxWaitSeconds = 60
$elapsed = 0
$windowFound = $false
while ($elapsed -lt $maxWaitSeconds) {
    $proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*JBEdu*" -or $_.MainWindowTitle -like "*JB메신저*" }
    if ($proc -and $proc.MainWindowHandle -ne 0) {
        $windowFound = $true
        break
    }
    Start-Sleep -Milliseconds 500
    $elapsed += 0.5
}

if (-not $windowFound) {
    # 🔑 60초가 지나도 창을 못 찾으면, 문제 파악을 위해 로그만 남기고 스크립트 종료 (엉뚱한 곳에 입력하는 사고 방지)
    Add-Content -Path "$env:APPDATA\office-calendar\jbmessenger-login-log.txt" -Value "$(Get-Date): 창을 찾지 못해 종료됨"
    exit
}

# 🔑 창이 완전히 그려질 시간을 위해 약간의 추가 대기
Start-Sleep -Milliseconds 1500

# 3. 창 활성화 — 실패할 경우를 대비해 여러 번 재시도
for ($i = 0; $i -lt 5; $i++) {
    try {
        [Microsoft.VisualBasic.Interaction]::AppActivate("JBEdu Messenger")
        break
    } catch {
        Start-Sleep -Seconds 2
    }
}
Start-Sleep -Milliseconds 800
# 4. 메뉴 버튼(초기 포커스) → 아이디 칸까지 Tab 7번
1..7 | ForEach-Object {
    [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
    Start-Sleep -Milliseconds 100
}
# 5. 아이디 칸 → 인증서 비밀번호 칸까지 Tab 2번
[System.Windows.Forms.SendKeys]::SendWait("{TAB}{TAB}")
Start-Sleep -Milliseconds 200
# 6. 인증서 비밀번호 입력 — Base64로 안전하게 전달받아 디코딩 (특수문자로 인한 스크립트 깨짐 방지)
$jbPasswordBase64 = "__JB_PASSWORD_BASE64__"
$jbPasswordBytes = [System.Convert]::FromBase64String($jbPasswordBase64)
$jbPassword = [System.Text.Encoding]::UTF8.GetString($jbPasswordBytes)
[System.Windows.Forms.SendKeys]::SendWait($jbPassword)
Start-Sleep -Milliseconds 300
# 7. 로그인
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")