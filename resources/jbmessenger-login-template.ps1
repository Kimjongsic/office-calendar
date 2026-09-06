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

# 2. 프로세스 이름으로 최상위 창을 정확히 찾음
$root = [System.Windows.Automation.AutomationElement]::RootElement
$jbWindow = $null
$maxWaitSeconds = 60
$elapsed = 0
while ($elapsed -lt $maxWaitSeconds) {
    $jbProcess = Get-Process -Name "AtMessengerMobileEdition" -ErrorAction SilentlyContinue
    if ($jbProcess -and $jbProcess.MainWindowHandle -ne 0) {
        try {
            $jbWindow = [System.Windows.Automation.AutomationElement]::FromHandle($jbProcess.MainWindowHandle)
        } catch {
            $jbWindow = $null
        }
    }
    if ($jbWindow) { break }
    Start-Sleep -Milliseconds 500
    $elapsed += 0.5
}

if ($jbWindow) {
    Add-Content -Path $logPath -Value "$(Get-Date): 최상위 창 찾음, 전체 트리 구조 덤프 시작"

    # 🔑 [임시 디버깅용] 이 스크립트 입장에서 실제로 보이는 트리 구조를 전부 로그에 남김
    function Dump-Tree {
        param($element, $depth, $logPath)
        if ($depth -gt 8) { return }
        $indent = "  " * $depth
        try {
            $name = $element.Current.Name
            $controlType = $element.Current.ControlType.ProgrammaticName
            $className = $element.Current.ClassName
            Add-Content -Path $logPath -Value "$indent[$depth] Name='$name' Type=$controlType Class='$className'"
        } catch {
            Add-Content -Path $logPath -Value "$indent[$depth] (속성 읽기 실패)"
        }
        try {
            $children = $element.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
            foreach ($child in $children) {
                Dump-Tree -element $child -depth ($depth + 1) -logPath $logPath
            }
        } catch {
            Add-Content -Path $logPath -Value "$indent  (자식 탐색 실패)"
        }
    }
    Dump-Tree -element $jbWindow -depth 0 -logPath $logPath
    Add-Content -Path $logPath -Value "$(Get-Date): 트리 구조 덤프 끝"

    Add-Content -Path $logPath -Value "$(Get-Date): 중첩된 자식 창을 단계별로 탐색 시작"
    # 🔑 [신규] Descendants 탐색이 중첩된 이름 없는 창들 사이에서 끊기는 문제를 우회하기 위해,
    # Window 타입 자식을 한 단계씩 직접 파고 내려감 (최대 5단계까지)
    $currentElement = $jbWindow
    for ($depth = 0; $depth -lt 5; $depth++) {
        $windowChildCondition = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Window
        )
        $childWindow = $currentElement.FindFirst([System.Windows.Automation.TreeScope]::Children, $windowChildCondition)
        if ($childWindow) {
            Add-Content -Path $logPath -Value "$(Get-Date): ${depth}단계 자식 창 발견 - 이름: '$($childWindow.Current.Name)'"
            $currentElement = $childWindow
        } else {
            Add-Content -Path $logPath -Value "$(Get-Date): ${depth}단계에서 더 이상 자식 창 없음, 탐색 종료"
            break
        }
    }
    $jbWindow = $currentElement
}

if (-not $jbWindow) {
    Add-Content -Path $logPath -Value "$(Get-Date): 창을 찾지 못해 종료됨"
    # 🔑 [임시 디버깅용] 현재 떠 있는 모든 최상위 창 이름을 로그로 남김
    $windowCondition2 = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Window
    )
    $allWindows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $windowCondition2)
    foreach ($w in $allWindows) {
        Add-Content -Path $logPath -Value "  - 발견된 창: $($w.Current.Name)"
    }
    exit
}
Add-Content -Path $logPath -Value "$(Get-Date): 창 찾음 - 이름: $($jbWindow.Current.Name)"

# 🔑 [수정] 창은 찾았지만 그 안의 로그인 폼(입력창 등)이 아직 안 그려졌을 수 있으므로,
# 입력창이 실제로 나타날 때까지 최대 10초간 반복 탐색
# 🔑 [수정] 이 프로그램의 입력창은 진짜 "Edit"가 아니라, 클래스명이 "UltariChildEdit"인 커스텀 Pane 컨트롤임
$editCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ClassNameProperty,
    "UltariChildEdit"
)
$edits = $null
$innerElapsed = 0
while ($innerElapsed -lt 10) {
    $edits = $jbWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCondition)
    if ($edits.Count -gt 0) { break }
    Start-Sleep -Milliseconds 500
    $innerElapsed += 0.5
}
Add-Content -Path $logPath -Value "$(Get-Date): 입력창 탐색 시작 (대기 ${innerElapsed}초 소요)"

# 3. 🔑 위에서 찾은 Edit(입력창) 요소들 중, 비밀번호 칸을 특정
#    (1순위: IsPassword 속성이 true인 것 / 2순위: 화면상 가장 아래(Y좌표가 큰) Edit 요소)
Add-Content -Path $logPath -Value "$(Get-Date): 발견된 입력창(UltariChildEdit) 개수: $($edits.Count)"
foreach ($e in $edits) {
    Add-Content -Path $logPath -Value "  - 값: '$($e.Current.Name)'"
}

# 🔑 [수정] 인증서(1번째), 아이디(2번째), 비밀번호(3번째, 이름이 비어있음) 순서로 뜨므로
# "값(Name)이 비어있는" 칸을 비밀번호 칸으로 특정
$passwordEdit = $edits | Where-Object { [string]::IsNullOrEmpty($_.Current.Name) } | Select-Object -First 1

if (-not $passwordEdit -and $edits.Count -ge 3) {
    # 🔑 안전장치: 위 방식으로 못 찾으면, 화면상 위→아래 순서로 3번째 칸을 비밀번호 칸으로 간주
    $passwordEdit = $edits | Sort-Object { $_.Current.BoundingRectangle.Top } | Select-Object -Skip 2 -First 1
}

if (-not $passwordEdit -and $edits.Count -gt 0) {
    $passwordEdit = $edits | Sort-Object { $_.Current.BoundingRectangle.Top } -Descending | Select-Object -First 1
}


if (-not $passwordEdit) {
    Add-Content -Path $logPath -Value "$(Get-Date): 비밀번호 입력창을 찾지 못해 종료됨"
    exit
}

# 4. 🔑 [수정] SetFocus가 이 커스텀 컨트롤에서 지원되지 않으므로,
# UI Automation으로 알아낸 "이 요소의 실제 화면 좌표" 중심점을 정밀 클릭 (하드코딩된 좌표 아님 - 항상 정확)
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ClickHelper {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
    public const uint MOUSEEVENTF_LEFTDOWN = 0x02;
    public const uint MOUSEEVENTF_LEFTUP = 0x04;
    public static void ClickAt(int x, int y) {
        SetCursorPos(x, y);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    }
}
"@

$rect = $passwordEdit.Current.BoundingRectangle
$centerX = [int]($rect.Left + ($rect.Width / 2))
$centerY = [int]($rect.Top + ($rect.Height / 2))
Add-Content -Path $logPath -Value "$(Get-Date): 비밀번호 칸 실제 좌표 확인 - X=$centerX, Y=$centerY"
[ClickHelper]::ClickAt($centerX, $centerY)
Add-Content -Path $logPath -Value "$(Get-Date): 비밀번호 칸 클릭 완료"
Start-Sleep -Milliseconds 300

$loggedIn = $false
if ($loginButton) {
    try {
        $btnRect = $loginButton.Current.BoundingRectangle
        $btnX = [int]($btnRect.Left + ($btnRect.Width / 2))
        $btnY = [int]($btnRect.Top + ($btnRect.Height / 2))
        Add-Content -Path $logPath -Value "$(Get-Date): 로그인 버튼 실제 좌표 확인 - X=$btnX, Y=$btnY"
        [ClickHelper]::ClickAt($btnX, $btnY)
        Add-Content -Path $logPath -Value "$(Get-Date): 로그인 버튼 클릭 완료"
        $loggedIn = $true
    } catch {
        Add-Content -Path $logPath -Value "$(Get-Date): 로그인 버튼 클릭 실패 - $($_.Exception.Message)"
    }
} else {
    Add-Content -Path $logPath -Value "$(Get-Date): 로그인 버튼을 찾지 못함"
}

if (-not $loggedIn) {
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Add-Content -Path $logPath -Value "$(Get-Date): 안전장치로 Enter 입력"
}
