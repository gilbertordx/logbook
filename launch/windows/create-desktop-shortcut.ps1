# Creates a desktop shortcut to the Logbook menu. Run once (use create-desktop-shortcut.bat).
$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$target  = Join-Path $here "logbook-menu.bat"
$project = (Resolve-Path (Join-Path $here "..\..")).Path
$desktop = [Environment]::GetFolderPath("Desktop")      # also right when the desktop lives in OneDrive
$link    = Join-Path $desktop "Logbook (Rust).lnk"

$shell = New-Object -ComObject WScript.Shell
$s = $shell.CreateShortcut($link)
$s.TargetPath       = $target
$s.WorkingDirectory = $project
$s.Description      = "Logbook - Rust remaster: run it with live reload, test it, build it"
$s.Save()
Write-Host "Created: $link"
Write-Host "Double-click it to open the menu."
