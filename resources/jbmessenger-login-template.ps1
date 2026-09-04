[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic
# 0. 부팅 직후에는 바탕화면(explorer)이 아직 완전히 안 떴을 수 있으므로 넉넉히 대기
Start-Sleep -Seconds 10
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
# 6. 인증서 비밀번호 입력
[System.Windows.Forms.SendKeys]::SendWait("__JB_PASSWORD__")
Start-Sleep -Milliseconds 300
# 7. 로그인
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")