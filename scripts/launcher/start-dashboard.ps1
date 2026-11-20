# 노무 현황 관리표 실행기 — 바탕화면 바로가기 → start-dashboard.cmd → 이 파일
# 1) 이미 켜져 있으면 브라우저만 연다  2) 코드가 바뀌었으면 다시 빌드한다  3) 서버를 켜고, 준비되면 브라우저를 연다
# (cmd 배치 파일은 한글이 들어가면 줄을 잘못 읽는 문제가 있어 실제 동작은 PowerShell로 한다)
$ErrorActionPreference = "Stop"
$project = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $project
$url = "http://localhost:3000"
$Host.UI.RawUI.WindowTitle = "노무 현황 관리표 - 노무 Risk, Low Return (이 창을 닫으면 꺼집니다)"

# 1) 이미 실행 중이면 브라우저만 연다
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "노무 현황 관리표가 이미 켜져 있습니다. 브라우저를 엽니다."
  Start-Process $url
  Start-Sleep -Seconds 3
  exit 0
}

# 2) 빌드가 없거나 코드가 빌드보다 새로우면 다시 빌드한다
$buildId = Join-Path $project ".next\BUILD_ID"
$needBuild = $true
if (Test-Path $buildId) {
  $builtAt = (Get-Item $buildId).LastWriteTime
  $sources = @(Get-ChildItem app, lib, components -Recurse -File) + @(Get-Item proxy.ts, next.config.ts, package.json)
  $needBuild = @($sources | Where-Object { $_.LastWriteTime -gt $builtAt }).Count -gt 0
}
if ($needBuild) {
  Write-Host "새로 바뀐 내용이 있어 준비하는 중입니다. 1분 정도 걸립니다..."
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "준비 중 오류가 났습니다. 이 창의 내용을 Claude에게 보여 주세요."
    Read-Host "엔터를 누르면 창이 닫힙니다"
    exit 1
  }
}

# 3) 서버가 준비되면 브라우저를 연다 (뒤에서 기다리다가 연다)
$waitAndOpen = "for (`$i=0; `$i -lt 60; `$i++) { try { Invoke-WebRequest -UseBasicParsing '$url/login' -TimeoutSec 2 | Out-Null; Start-Process '$url'; break } catch { Start-Sleep -Seconds 1 } }"
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile", "-Command", $waitAndOpen

Write-Host ""
Write-Host " 노무 현황 관리표를 켰습니다: $url"
Write-Host " 이 창을 닫으면 노무 현황 관리표가 꺼집니다. 쓰는 동안에는 열어 두세요."
Write-Host ""
& npm.cmd run start
