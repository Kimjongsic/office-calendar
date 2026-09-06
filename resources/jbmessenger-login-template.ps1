[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$logPath = "$env:APPDATA\office-calendar\jbmessenger-login-log.txt"
Add-Content -Path $logPath -Value "$(Get-Date): script started"

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

# 0. Wait until LogonUI actually disappears (max 5 minutes)
$maxLoginWaitSeconds = 300
$loginWaited = 0
while ((Get-Process -Name "LogonUI" -ErrorAction SilentlyContinue) -and ($loginWaited -lt $maxLoginWaitSeconds)) {
    Start-Sleep -Seconds 2
    $loginWaited += 2
}
Start-Sleep -Seconds 5
Add-Content -Path $logPath -Value "$(Get-Date): login wait done, launching messenger"

# 1. Launch JBEdu Messenger
Start-Process "C:\Program Files (x86)\JBEdu Messenger+\Launcher.exe"

# 2. Wait for the actual process (AtMessengerMobileEdition) to appear
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

if (-not $jbWindow) {
    Add-Content -Path $logPath -Value "$(Get-Date): window not found, exiting"
    exit
}
Add-Content -Path $logPath -Value "$(Get-Date): window found - name: $($jbWindow.Current.Name)"

Start-Sleep -Seconds 2

# 3. Input fields are custom controls with class name "UltariChildEdit"
#    Order: certificate(1st), ID(2nd), password(3rd, value is empty)
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
Add-Content -Path $logPath -Value "$(Get-Date): found input fields (UltariChildEdit) count: $($edits.Count)"
foreach ($e in $edits) {
    Add-Content -Path $logPath -Value "  - value: '$($e.Current.Name)'"
}

# Field with empty value = password field
$passwordEdit = $edits | Where-Object { [string]::IsNullOrEmpty($_.Current.Name) } | Select-Object -First 1

if (-not $passwordEdit -and $edits.Count -ge 3) {
    $passwordEdit = $edits | Sort-Object { $_.Current.BoundingRectangle.Top } | Select-Object -Skip 2 -First 1
}
if (-not $passwordEdit -and $edits.Count -gt 0) {
    $passwordEdit = $edits | Sort-Object { $_.Current.BoundingRectangle.Top } -Descending | Select-Object -First 1
}

if (-not $passwordEdit) {
    Add-Content -Path $logPath -Value "$(Get-Date): password field not found, exiting"
    exit
}

# 4. SetFocus is not supported on this custom control, so click the actual screen coordinates
$rect = $passwordEdit.Current.BoundingRectangle
$centerX = [int]($rect.Left + ($rect.Width / 2))
$centerY = [int]($rect.Top + ($rect.Height / 2))
Add-Content -Path $logPath -Value "$(Get-Date): password field coordinates - X=$centerX, Y=$centerY"
[ClickHelper]::ClickAt($centerX, $centerY)
Add-Content -Path $logPath -Value "$(Get-Date): password field clicked"
Start-Sleep -Milliseconds 300

# Enter password (decoded from Base64)
$jbPasswordBase64 = "__JB_PASSWORD_BASE64__"
$jbPasswordBytes = [System.Convert]::FromBase64String($jbPasswordBase64)
$jbPassword = [System.Text.Encoding]::UTF8.GetString($jbPasswordBytes)
[System.Windows.Forms.SendKeys]::SendWait($jbPassword)
Add-Content -Path $logPath -Value "$(Get-Date): password entered"

Start-Sleep -Milliseconds 300

# 5. Login button is also a custom "Button"-class Pane control
$buttonClassCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ClassNameProperty, "Button"
)
$allButtons = $jbWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $buttonClassCondition)
Add-Content -Path $logPath -Value "$(Get-Date): found buttons count: $($allButtons.Count)"
foreach ($b in $allButtons) {
    Add-Content -Path $logPath -Value "  - button name: '$($b.Current.Name)'"
}
# "Login" button name in Korean, Base64-encoded to avoid any encoding issues in this script file
$loginButtonNameBytes = [System.Convert]::FromBase64String("66Gc6re467CY7J20")
$loginButtonName = [System.Text.Encoding]::UTF8.GetString($loginButtonNameBytes)
$loginButton = $allButtons | Where-Object { $_.Current.Name -eq $loginButtonName } | Select-Object -First 1

$loggedIn = $false
if ($loginButton) {
    try {
        $btnRect = $loginButton.Current.BoundingRectangle
        $btnX = [int]($btnRect.Left + ($btnRect.Width / 2))
        $btnY = [int]($btnRect.Top + ($btnRect.Height / 2))
        Add-Content -Path $logPath -Value "$(Get-Date): login button coordinates - X=$btnX, Y=$btnY"
        [ClickHelper]::ClickAt($btnX, $btnY)
        Add-Content -Path $logPath -Value "$(Get-Date): login button clicked"
        $loggedIn = $true
    } catch {
        Add-Content -Path $logPath -Value "$(Get-Date): login button click failed - $($_.Exception.Message)"
    }
} else {
    Add-Content -Path $logPath -Value "$(Get-Date): login button not found"
}

if (-not $loggedIn) {
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Add-Content -Path $logPath -Value "$(Get-Date): fallback Enter key sent"
}

Add-Content -Path $logPath -Value "$(Get-Date): script finished"