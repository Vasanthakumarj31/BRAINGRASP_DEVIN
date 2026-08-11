$file = 'c:\Users\vasan\OneDrive\Desktop\G_GRASP\BRAINGRASP_DEVIN\backend\server.js'
$lines = Get-Content $file
$listenLine = ($lines | Select-String -Pattern 'app\.listen\(port' | Select-Object -First 1).LineNumber
$listenIdx = $listenLine - 1
Write-Host "app.listen found at line: $($listenIdx + 1)"
$keep = $lines[0..1473] + $lines[$listenIdx..($lines.Count - 1)]
Set-Content -Path $file -Value $keep -Encoding UTF8
Write-Host "Done. New line count: $($keep.Count)"
