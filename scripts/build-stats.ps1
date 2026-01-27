# build-stats.ps1
# Measure and report bundle sizes after build

Write-Host "Building project..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "=== Bundle Analysis ===" -ForegroundColor Green
Write-Host ""

$jsFiles = Get-ChildItem -Path "dist/assets" -Filter "*.js" -ErrorAction SilentlyContinue
$cssFiles = Get-ChildItem -Path "dist/assets" -Filter "*.css" -ErrorAction SilentlyContinue

$totalJs = 0
$totalCss = 0

Write-Host "JavaScript bundles:" -ForegroundColor Yellow
foreach ($file in $jsFiles) {
    $sizeKB = [math]::Round($file.Length / 1KB, 1)
    $totalJs += $file.Length
    Write-Host "  $($file.Name): $sizeKB KB"
}

Write-Host ""
Write-Host "CSS bundles:" -ForegroundColor Yellow
foreach ($file in $cssFiles) {
    $sizeKB = [math]::Round($file.Length / 1KB, 1)
    $totalCss += $file.Length
    Write-Host "  $($file.Name): $sizeKB KB"
}

$totalKB = [math]::Round(($totalJs + $totalCss) / 1KB, 1)
$totalJsKB = [math]::Round($totalJs / 1KB, 1)
$totalCssKB = [math]::Round($totalCss / 1KB, 1)

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Green
Write-Host "  Total JS:  $totalJsKB KB"
Write-Host "  Total CSS: $totalCssKB KB"
Write-Host "  Total:     $totalKB KB"

# Thresholds
$jsThreshold = 1000 # 1 MB
$cssThreshold = 100 # 100 KB

Write-Host ""
if ($totalJs / 1KB -gt $jsThreshold) {
    Write-Host "WARNING: JS bundle exceeds $jsThreshold KB threshold!" -ForegroundColor Red
} else {
    Write-Host "OK: JS bundle is within threshold ($jsThreshold KB)" -ForegroundColor Green
}

if ($totalCss / 1KB -gt $cssThreshold) {
    Write-Host "WARNING: CSS bundle exceeds $cssThreshold KB threshold!" -ForegroundColor Red
} else {
    Write-Host "OK: CSS bundle is within threshold ($cssThreshold KB)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Competitor comparison:" -ForegroundColor Cyan
Write-Host "  Molt frontend:    $totalKB KB"
Write-Host "  ChatGPT typical:  ~2000-4000 KB (3-5x larger)"
Write-Host "  Claude web:       ~3000-5000 KB (4-6x larger)"
