# ==============================================================================
# FacePass PWA - Automated Health & Quality Check Script
# Runs:
# 1. Backend Unittests (py -3.14 -m unittest discover backend/tests)
# 2. Frontend Production Build (npm run build in frontend/)
# 3. AWS SAM Template Lint & Validation (sam validate --lint in backend/)
# ==============================================================================

$ErrorActionPreference = "Continue"
$ROOT_DIR = Split-Path -Parent $PSScriptRoot
if (-not $ROOT_DIR) { $ROOT_DIR = "C:\dev\facepass-pwa" }

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   FacePass PWA - Automated Pre-Commit Checks    " -ForegroundColor Cyan
Write-Host "   Root directory: $ROOT_DIR" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$results = [ordered]@{}
$hasFailure = $false

# ------------------------------------------------------------------------------
# Bước 1: Backend Unittests
# ------------------------------------------------------------------------------
Write-Host ">>> [1/3] Running Backend Unit Tests..." -ForegroundColor Yellow
Set-Location -Path $ROOT_DIR
py -3.14 -m unittest discover backend/tests
$testCode = $LASTEXITCODE

if ($testCode -eq 0) {
    $results["1. Backend Unittest"] = "[PASS] ExitCode=0"
    Write-Host ">>> [1/3] Backend Unit Tests: PASS" -ForegroundColor Green
} else {
    $results["1. Backend Unittest"] = "[FAIL] ExitCode=$testCode"
    Write-Host ">>> [1/3] Backend Unit Tests: FAIL (ExitCode=$testCode)" -ForegroundColor Red
    $hasFailure = $true
}
Write-Host ""

# ------------------------------------------------------------------------------
# Bước 2: Frontend Production Build
# ------------------------------------------------------------------------------
Write-Host ">>> [2/3] Running Frontend Production Build..." -ForegroundColor Yellow
Set-Location -Path "$ROOT_DIR\frontend"
npm run build
$buildCode = $LASTEXITCODE

if ($buildCode -eq 0) {
    $results["2. Frontend Build"] = "[PASS] ExitCode=0"
    Write-Host ">>> [2/3] Frontend Production Build: PASS" -ForegroundColor Green
} else {
    $results["2. Frontend Build"] = "[FAIL] ExitCode=$buildCode"
    Write-Host ">>> [2/3] Frontend Production Build: FAIL (ExitCode=$buildCode)" -ForegroundColor Red
    $hasFailure = $true
}
Write-Host ""

# ------------------------------------------------------------------------------
# Bước 3: AWS SAM Template Lint & Validation
# ------------------------------------------------------------------------------
Write-Host ">>> [3/3] Running SAM Validate & Lint..." -ForegroundColor Yellow
Set-Location -Path "$ROOT_DIR\backend"
sam validate --lint --region ap-southeast-1
$samCode = $LASTEXITCODE

if ($samCode -eq 0) {
    $results["3. SAM Validate & Lint"] = "[PASS] ExitCode=0"
    Write-Host ">>> [3/3] SAM Validate & Lint: PASS" -ForegroundColor Green
} else {
    $results["3. SAM Validate & Lint"] = "[FAIL] ExitCode=$samCode"
    Write-Host ">>> [3/3] SAM Validate & Lint: FAIL (ExitCode=$samCode)" -ForegroundColor Red
    $hasFailure = $true
}
Write-Host ""

# ------------------------------------------------------------------------------
# Bảng Tổng Kết Kết Quả
# ------------------------------------------------------------------------------
Set-Location -Path $ROOT_DIR
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "                 SUMMARY RESULTS                  " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
foreach ($key in $results.Keys) {
    $val = $results[$key]
    if ($val -like "*PASS*") {
        Write-Host ("{0,-28} : {1}" -f $key, $val) -ForegroundColor Green
    } else {
        Write-Host ("{0,-28} : {1}" -f $key, $val) -ForegroundColor Red
    }
}
Write-Host "==================================================" -ForegroundColor Cyan

if ($hasFailure) {
    Write-Host "Result: ONE OR MORE CHECKS FAILED." -ForegroundColor Red
    exit 1
} else {
    Write-Host "Result: ALL CHECKS PASSED!" -ForegroundColor Green
    exit 0
}

