# ==============================================================================
# FacePass PWA - Preflight Verification Script (READ-ONLY)
#
# PURPOSE:
# Pre-deployment validation of developer environment, AWS IAM credentials,
# SSM parameters metadata, repository hygiene, and security posture.
#
# CRITICAL SECURITY MANDATES:
# 1. READ-ONLY operations strictly.
# 2. ZERO secrets printed: Never retrieves SSM values (--with-decryption is forbidden).
# 3. Masks AWS Account ID (prints only the last 4 digits).
# 4. Exits with code 1 if any check FAILS, code 0 if all essential checks pass.
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$SkipAws
)

$ErrorActionPreference = "Continue"

$ROOT_DIR = Split-Path -Parent $PSScriptRoot
if (-not $ROOT_DIR) { $ROOT_DIR = "C:\dev\facepass-pwa" }
Set-Location -Path $ROOT_DIR

$hasFail = $false

function Write-Pass([string]$name, [string]$detail) {
    Write-Host "  [PASS] " -ForegroundColor Green -NoNewline
    Write-Host ("{0,-35} : {1}" -f $name, $detail)
}

function Write-Warn([string]$name, [string]$detail) {
    Write-Host "  [WARN] " -ForegroundColor Yellow -NoNewline
    Write-Host ("{0,-35} : {1}" -f $name, $detail)
}

function Write-Fail([string]$name, [string]$detail) {
    $script:hasFail = $true
    Write-Host "  [FAIL] " -ForegroundColor Red -NoNewline
    Write-Host ("{0,-35} : {1}" -f $name, $detail)
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                  FacePass PWA - Pre-Deployment Preflight Check                 " -ForegroundColor Cyan
Write-Host "                  Root directory: $ROOT_DIR                                     " -ForegroundColor Cyan
if ($SkipAws) {
    Write-Host "                  Mode: LOCAL ONLY (-SkipAws flag enabled)                      " -ForegroundColor Yellow
} else {
    Write-Host "                  Mode: FULL (Local + AWS IAM & SSM Verification)               " -ForegroundColor Cyan
}
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# ==============================================================================
# Part A: Tools & Local Environment Check
# ==============================================================================
Write-Host ">>> [A] Tools & Local Environment Check:" -ForegroundColor Cyan

# 1. Python / py launcher
$pyCheck = Get-Command py -ErrorAction SilentlyContinue
if ($pyCheck) {
    $pyVer = (py -3.14 --version 2>&1)
    if ($LASTEXITCODE -eq 0) {
        Write-Pass "Python Launcher (py -3.14)" $pyVer
    } else {
        $pyAny = (py --version 2>&1)
        Write-Pass "Python Launcher (py)" $pyAny
    }
} else {
    $pythonCheck = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCheck) {
        $pyVer = (python --version 2>&1)
        Write-Pass "Python CLI" $pyVer
    } else {
        Write-Fail "Python" "Neither py nor python found in PATH"
    }
}

# 2. Node.js
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCheck) {
    $nodeVer = (node --version 2>&1)
    Write-Pass "Node.js" $nodeVer
} else {
    Write-Fail "Node.js" "Node.js not found in PATH"
}

# 3. npm
$npmCheck = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCheck) {
    $npmVer = (npm --version 2>&1)
    Write-Pass "npm CLI" "v$npmVer"
} else {
    Write-Fail "npm" "npm not found in PATH"
}

# 4. AWS SAM CLI
$samCheck = Get-Command sam -ErrorAction SilentlyContinue
if ($samCheck) {
    $samVer = (sam --version 2>&1)
    Write-Pass "AWS SAM CLI" $samVer
} else {
    Write-Fail "AWS SAM CLI" "sam not found in PATH. Please install AWS SAM CLI."
}

# 5. AWS CLI
$awsCheck = Get-Command aws -ErrorAction SilentlyContinue
if ($awsCheck) {
    $awsVer = (aws --version 2>&1)
    Write-Pass "AWS CLI" ($awsVer -split "`n")[0].Trim()
} else {
    Write-Fail "AWS CLI" "aws not found in PATH. Please install AWS CLI v2."
}

# 6. Docker CLI & Docker Daemon
$dockerCheck = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCheck) {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerVer = (docker --version 2>&1)
        Write-Pass "Docker Daemon" "$dockerVer (Daemon is running)"
    } else {
        Write-Fail "Docker Daemon" "Docker CLI exists but Docker Desktop is not running or daemon is unavailable"
    }
} else {
    Write-Fail "Docker" "docker not found in PATH. Docker is required to build Pillow Lambda layer."
}
Write-Host ""

# ==============================================================================
# Part B & C: AWS IAM Credentials & SSM Parameter Store (Skipped if -SkipAws)
# ==============================================================================
if ($SkipAws) {
    Write-Host ">>> [B & C] AWS IAM & SSM Parameter Store: SKIPPED (-SkipAws)" -ForegroundColor Yellow
    Write-Host "    (To run AWS verification, execute: powershell -ExecutionPolicy Bypass -File .\scripts\preflight.ps1)" -ForegroundColor DarkGray
    Write-Host ""
} else {
    Write-Host ">>> [B] AWS IAM Credentials & Region Check:" -ForegroundColor Cyan

    # 1. AWS_PROFILE
    if ($env:AWS_PROFILE) {
        Write-Pass "AWS_PROFILE variable" "Using profile '$env:AWS_PROFILE'"
    } else {
        Write-Warn "AWS_PROFILE variable" "Not set. Recommended: `$env:AWS_PROFILE = 'facepass'"
    }

    # 2. Caller Identity (IAM User check, Masked Account ID)
    $stsRaw = aws sts get-caller-identity --output json 2>&1
    if ($LASTEXITCODE -eq 0) {
        try {
            $sts = $stsRaw | ConvertFrom-Json
            $arn = $sts.Arn
            $acct = $sts.Account
            $maskedAcct = "****" + $acct.Substring([Math]::Max(0, $acct.Length - 4))

            if ($arn -like "*:root") {
                Write-Fail "AWS Identity" "ARN is '$arn' (ROOT account)! Use AWS Academy Sandbox credentials."
            } else {
                Write-Pass "AWS Identity" "ARN: $arn (Account: $maskedAcct)"
            }
        } catch {
            Write-Fail "AWS Identity Parse" "Failed to parse JSON from sts get-caller-identity"
        }
    } else {
        Write-Fail "AWS Authentication" "Failed to authenticate with AWS CLI. Run: aws configure --profile facepass"
    }

    # 3. AWS Region check
    $profileArg = if ($env:AWS_PROFILE) { "--profile $env:AWS_PROFILE" } else { "" }
    $regionRaw = (aws configure get region $profileArg 2>&1)
    if ($regionRaw) {
        $currentRegion = $regionRaw.Trim()
        if ($currentRegion -eq "us-east-1") {
            Write-Pass "AWS Region" "Matches required region 'us-east-1' (N. Virginia)"
        } else {
            Write-Fail "AWS Region" "Current region is '$currentRegion' (expected us-east-1)"
        }
    } else {
        Write-Warn "AWS Region" "Region not detected from profile. Deploy template will prompt for us-east-1."
    }
    Write-Host ""

    Write-Host ">>> [C] AWS SSM Parameter Store Check (READ-ONLY Metadata):" -ForegroundColor Cyan
    # READ-ONLY check: ONLY calls describe-parameters. NEVER calls get-parameter or --with-decryption!
    $ssmRaw = aws ssm describe-parameters --parameter-filters "Key=Name,Option=BeginsWith,Values=/facepass/gmail/" --output json 2>&1
    if ($LASTEXITCODE -eq 0) {
        try {
            $ssmJson = $ssmRaw | ConvertFrom-Json
            $params = $ssmJson.Parameters

            $userParam = $params | Where-Object { $_.Name -eq "/facepass/gmail/username" }
            $passParam = $params | Where-Object { $_.Name -eq "/facepass/gmail/app_password" }

            if ($userParam) {
                if ($userParam.Type -eq "SecureString") {
                    Write-Pass "SSM Username Param" "Found /facepass/gmail/username (Type: SecureString)"
                } else {
                    Write-Fail "SSM Username Param" "/facepass/gmail/username has Type '$($userParam.Type)', expected SecureString"
                }
            } else {
                Write-Fail "SSM Username Param" "Missing parameter /facepass/gmail/username in Parameter Store"
            }

            if ($passParam) {
                if ($passParam.Type -eq "SecureString") {
                    Write-Pass "SSM Password Param" "Found /facepass/gmail/app_password (Type: SecureString)"
                } else {
                    Write-Fail "SSM Password Param" "/facepass/gmail/app_password has Type '$($passParam.Type)', expected SecureString"
                }
            } else {
                Write-Fail "SSM Password Param" "Missing parameter /facepass/gmail/app_password in Parameter Store"
            }
        } catch {
            Write-Fail "SSM Parse Error" "Failed to parse describe-parameters JSON output"
        }
    } else {
        Write-Fail "SSM Parameter Store" "Failed to connect to AWS SSM Parameter Store in this region."
    }
    Write-Host ""
}

# ==============================================================================
# Part D: Repository Safety & Git Hygiene Check
# ==============================================================================
Write-Host ">>> [D] Repository Safety & Git Hygiene Check:" -ForegroundColor Cyan

# 1. Git clean status
$gitStatus = git status --porcelain 2>&1
if (-not $gitStatus) {
    Write-Pass "Git Status" "Working tree is clean"
} else {
    Write-Warn "Git Status" "Working tree has uncommitted changes"
}

# 2. .env.production.local protection
$ignoreCheck = git check-ignore frontend/.env.production.local 2>&1
if ($ignoreCheck -and $LASTEXITCODE -eq 0) {
    Write-Pass ".env.production.local" "Protected by .gitignore (will not be committed accidentally)"
} else {
    Write-Fail ".env.production.local" "Not ignored by .gitignore! High risk of secret/ID leakage."
}

# 3. Secret leak check in tracked files (excluding scripts/preflight.ps1 and README.md, building pattern from pieces)
$p1 = "AK" + "IA[0-9A-Z]{16}"
$p2 = "AS" + "IA[0-9A-Z]{16}"
$p3 = "aws_sec" + "ret_access_key"
$p4 = "BEG" + "IN [A-Z ]*PRIVATE KEY"
$regexPattern = "($p1|$p2|$p3|$p4)"

$leakRaw = git grep -E -I $regexPattern -- ":(exclude)scripts/preflight.ps1" ":(exclude)README.md" 2>&1
if ($LASTEXITCODE -eq 0 -and $leakRaw) {
    Write-Fail "Secret Leak Scanner" "Suspected access key or private key pattern found in tracked files:`n$leakRaw"
} else {
    Write-Pass "Secret Leak Scanner" "No Access Key or Private Key patterns found in tracked files"
}

# 4. samconfig.toml tracking check
$samConfigTracked = git ls-files backend/samconfig.toml samconfig.toml 2>&1
if ($samConfigTracked) {
    Write-Fail "samconfig.toml" "samconfig.toml is tracked by git! Remove it from git tracking."
} else {
    Write-Pass "samconfig.toml" "Blocked by .gitignore, not tracked by git"
}
Write-Host ""

# ==============================================================================
# Part E: Manual Security Reminders (AWS Academy Sandbox Checklist)
# ==============================================================================
Write-Host ">>> [E] Manual Security Reminders (AWS Academy Sandbox Checklist):" -ForegroundColor Cyan
Write-Host "  [i] [ ] AWS Academy Sandbox active in us-east-1 (N. Virginia)." -ForegroundColor Yellow
Write-Host "  [i] [ ] Session credentials valid up to 180 mins (restart lab and update CLI keys when expired)." -ForegroundColor Yellow
Write-Host "  [i] [ ] Lambda functions configured to use LabRole (arn:aws:iam::\${AWS::AccountId}:role/LabRole)." -ForegroundColor Yellow
Write-Host "  [i] [ ] Never paste AWS keys or App Passwords into chat or git repository." -ForegroundColor Yellow
Write-Host ""

# ==============================================================================
# Summary
# ==============================================================================
Write-Host "================================================================================" -ForegroundColor Cyan
if ($hasFail) {
    Write-Host "   PREFLIGHT RESULT: FAILED CHECKS DETECTED. Please resolve before deploying!   " -ForegroundColor Red
    Write-Host "================================================================================" -ForegroundColor Cyan
    exit 1
} else {
    Write-Host "   PREFLIGHT RESULT: ALL CHECKS PASSED! Ready for deployment.                   " -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Cyan
    exit 0
}
