[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic
# 0. 부팅 직후에는 바탕화면(explorer)이 아직 완전히 안 떴을 수 있으므로 넉넉히 대기
Start-Sleep -Seconds 10
# 1. JBEdu Messenger 실행
Start-Process "C:\Program Files (x86)\JBEdu Messenger+\Launcher.exe"
# 2. 창 뜰 때까지 대기 (부팅 직후엔 평소보다 느릴 수 있어 넉넉히)
Start-Sleep -Seconds 8
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