[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic
# 1. JBEdu Messenger 실행
Start-Process "C:\Program Files (x86)\JBEdu Messenger+\Launcher.exe"
# 2. 창 뜰 때까지 대기
Start-Sleep -Seconds 5
# 3. 창 활성화
[Microsoft.VisualBasic.Interaction]::AppActivate("JBEdu Messenger")
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