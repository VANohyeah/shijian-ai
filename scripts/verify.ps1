param(
  [string]$Base = "http://localhost:3000",
  [string]$Image = "test-menu.png"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$imgPath = if ([IO.Path]::IsPathRooted($Image)) { $Image } else { Join-Path $root $Image }

Write-Host "== 1. 健康检查 ==" -ForegroundColor Cyan
try {
  $h = Invoke-RestMethod "$Base/api/health" -TimeoutSec 10
  $h | ConvertTo-Json -Depth 5
} catch {
  Write-Host "服务没起来，先运行 npm run dev" -ForegroundColor Red
  exit 1
}

if (-not $h.ready) {
  Write-Host ""
  Write-Host "还没有配置任何 API Key，把 .env.example 复制成 .env 并填入 GLM_API_KEY" -ForegroundColor Yellow
  exit 2
}

if (-not (Test-Path $imgPath)) {
  Write-Host "找不到测试图片：$imgPath" -ForegroundColor Red
  exit 3
}

Write-Host ""
Write-Host "== 2. 识图测试（$imgPath）==" -ForegroundColor Cyan
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($imgPath))
$body = @{ imageBase64 = $b64; mime = "image/png" } | ConvertTo-Json -Compress
$sw = [Diagnostics.Stopwatch]::StartNew()

try {
  $r = Invoke-RestMethod "$Base/api/dish/analyze" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 90
  $sw.Stop()
  Write-Host ("耗时 {0} ms" -f $sw.ElapsedMilliseconds) -ForegroundColor Green
  $r | ConvertTo-Json -Depth 5
} catch {
  $sw.Stop()
  Write-Host ("失败，耗时 {0} ms" -f $sw.ElapsedMilliseconds) -ForegroundColor Red
  $resp = $_.Exception.Response
  if ($resp) {
    $sr = New-Object IO.StreamReader($resp.GetResponseStream())
    Write-Host $sr.ReadToEnd()
  } else {
    Write-Host $_.Exception.Message
  }
  exit 4
}
