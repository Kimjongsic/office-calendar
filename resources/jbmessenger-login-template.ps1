[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$logPath = "$env:APPDATA\office-calendar\jbmessenger-login-log.txt"
Add-Content -Path $logPath -Value "$(Get-Date): 스크립트 시작됨"

# 0. 로그인 화면(LogonUI)이 사라질 때까지 대기
$maxLoginWaitSeconds = 300
$loginWaited = 0
while ((Get-Process -Name "LogonUI" -ErrorAction SilentlyContinue) -and ($loginWaited -lt $maxLoginWaitSeconds)) {
    Start-Sleep -Seconds 2
    $loginWaited += 2
}
Start-Sleep -Seconds 5
Add-Content -Path $logPath -Value "$(Get-Date): 로그인 대기 끝, 메신저 실행 시도"

# 1. JBEdu Messenger 실행
Start-Process "C:\Program Files (x86)\JBEdu Messenger+\Launcher.exe"

# 2. 🔑 [신규] UI Automation으로 JBEdu 창을 직접 찾음 (창 활성화/포커스와 무관하게 동작)
$root = [System.Windows.Automation.AutomationElement]::RootElement
$jbWindow = $null
$maxWaitSeconds = 60
$elapsed = 0
while ($elapsed -lt $maxWaitSeconds) {
    $windowCondition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Window
    )
    $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $windowCondition)
    foreach ($w in $windows) {
        if ($w.Current.Name -like "*JBEdu*" -or $w.Current.Name -like "*JB메신저*") {
            $jbWindow = $w
            break
        }
    }
    if ($jbWindow) { break }
    Start-Sleep -Milliseconds 500
    $elapsed += 0.5
}

if (-not $jbWindow) {
    Add-Content -Path $logPath -Value "$(Get-Date): 창을 찾지 못해 종료됨"
    exit
}
Add-Content -Path $logPath -Value "$(Get-Date): 창 찾음, 입력창 탐색 시작"

# 3. 🔑 창 안의 모든 Edit(입력창) 요소를 찾아서, 비밀번호 칸을 특정
#    (1순위: IsPassword 속성이 true인 것 / 2순위: 화면상 가장 아래(Y좌표가 큰) Edit 요소)
$editCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Edit
)
$edits = $jbWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCondition)

$passwordEdit = $null
foreach ($e in $edits) {
    $isPassword = $e.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::IsPasswordProperty)
    if ($isPassword -eq $true) {
        $passwordEdit = $e
        break
    }
}
if (-not $passwordEdit -and $edits.Count -gt 0) {
    # 🔑 IsPassword로 못 찾으면, 화면에서 가장 아래에 있는 입력창을 비밀번호 칸으로 간주 (안전장치)
    $passwordEdit = $edits | Sort-Object { $_.Current.BoundingRectangle.Top } -Descending | Select-Object -First 1
}

if (-not $passwordEdit) {
    Add-Content -Path $logPath -Value "$(Get-Date): 비밀번호 입력창을 찾지 못해 종료됨"
    exit
}

# 4. 비밀번호 입력 (SetValue — 활성 창/포커스와 무관하게 정확히 이 칸에만 값이 들어감)
$jbPasswordBase64 = "__JB_PASSWORD_BASE64__"
$jbPasswordBytes = [System.Convert]::FromBase64String($jbPasswordBase64)
$jbPassword = [System.Text.Encoding]::UTF8.GetString($jbPasswordBytes)

$valuePattern = $passwordEdit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
$valuePattern.SetValue($jbPassword)
Add-Content -Path $logPath -Value "$(Get-Date): 비밀번호 입력 완료"

Start-Sleep -Milliseconds 300

# 5. 🔑 로그인 버튼을 이름으로 직접 찾아서 클릭 (Enter 키 대신, 버튼을 정확히 지목해서 실행)
$buttonCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, "로그인"
)
$loginButton = $jbWindow.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $buttonCondition)

if ($loginButton) {
    $invokePattern = $loginButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invokePattern.Invoke()
    Add-Content -Path $logPath -Value "$(Get-Date): 로그인 버튼 클릭 완료"
} else {
    Add-Content -Path $logPath -Value "$(Get-Date): 로그인 버튼을 찾지 못함"
}