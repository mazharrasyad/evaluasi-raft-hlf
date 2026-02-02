$ErrorActionPreference = "Stop"

function Find-GitBash {
    $candidates = @(
        "D:\Git\bin\bash.exe",
        "D:\Git\usr\bin\bash.exe",
        "$env:ProgramFiles\Git\bin\bash.exe",
        "$env:ProgramFiles\Git\usr\bin\bash.exe",
        "$env:ProgramFiles(x86)\Git\bin\bash.exe",
        "$env:ProgramFiles(x86)\Git\usr\bin\bash.exe"
    ) | Where-Object { $_ -and (Test-Path $_) }

    if ($candidates.Count -gt 0) {
        return $candidates[0]
    }

    $bash = Get-Command bash -ErrorAction SilentlyContinue
    if ($bash) { return $bash.Source }

    return $null
}

$gitBash = Find-GitBash
if (-not $gitBash) {
    Write-Host "[ERROR] Git Bash not found."
    Write-Host "Install Git for Windows and ensure bash.exe exists."
    Write-Host "Example path: D:\Git\bin\bash.exe"
    exit 1
}

Write-Host "[INFO] Using Git Bash: $gitBash"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Host "[ERROR] Docker CLI not found. Install Docker Desktop first."
    exit 1
}

$tcpOk = $true
try {
    & docker -H tcp://127.0.0.1:2375 version *> $null
} catch {
    $tcpOk = $false
}
if (-not $tcpOk) {
    Write-Host "[ERROR] Docker TCP 2375 is not reachable."
    Write-Host "Enable Docker Desktop: Settings > General > \"Expose daemon on tcp://localhost:2375 without TLS\""
    Write-Host "Then restart Docker Desktop and rerun this script."
    exit 1
}

$jqCmd = Get-Command jq -ErrorAction SilentlyContinue
if (-not $jqCmd) {
    Write-Host "[ERROR] jq is required but not found."
    Write-Host "Install jq, then rerun this script."
    Write-Host "PowerShell options:"
    Write-Host "  choco install jq"
    Write-Host "  winget install jqlang.jq"
    exit 1
}

function Convert-ToBashPath {
    param([string]$WinPath)
    $p = $WinPath -replace '\\','/'
    if ($p -match '^([A-Za-z]):/(.*)$') {
        $drive = $Matches[1].ToLower()
        $rest = $Matches[2]
        return "/$drive/$rest"
    }
    return $p
}

$jqDir = Split-Path $jqCmd.Source
$jqDirBash = Convert-ToBashPath $jqDir
$bashPrefix = 'export PATH="' + $jqDirBash + ':$PATH";'

& $gitBash -lc "$bashPrefix jq --version" > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] jq is installed but not visible to Git Bash."
    Write-Host "Try restarting PowerShell, then rerun this script."
    exit 1
}
$env:FABRIC_WINDOWS_DOCKER = "1"
if (-not $env:CORE_VM_ENDPOINT) {
    $env:CORE_VM_ENDPOINT = "tcp://host.docker.internal:2375"
}

Write-Host "[INFO] Cleaning previous network..."
& $gitBash -lc "$bashPrefix cd '$scriptDir/raft/network'; ./network.sh down || true"
& $gitBash -lc "$bashPrefix cd '$scriptDir/smartbft/network'; ./network.sh down || true"

# Ensure old crypto and artifacts are removed so new domain names are used
$pathsToRemove = @(
    "$scriptDir\\raft\\network\\organizations\\peerOrganizations",
    "$scriptDir\\raft\\network\\organizations\\ordererOrganizations",
    "$scriptDir\\raft\\network\\channel-artifacts",
    "$scriptDir\\smartbft\\network\\organizations-variant\\peerOrganizations",
    "$scriptDir\\smartbft\\network\\organizations-variant\\ordererOrganizations",
    "$scriptDir\\smartbft\\network\\channel-artifacts"
)
foreach ($p in $pathsToRemove) {
    if (Test-Path $p) {
        Remove-Item -Recurse -Force $p
    }
}

Write-Host "[INFO] Starting RAFT network..."
& $gitBash -lc "$bashPrefix cd '$scriptDir/raft/network'; ./network.sh up createChannel -c raft"
& $gitBash -lc "$bashPrefix sleep 30"
& $gitBash -lc "$bashPrefix cd '$scriptDir/raft/network'; ./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl node -c raft"

Write-Host "[INFO] Starting SmartBFT network..."
& $gitBash -lc "$bashPrefix cd '$scriptDir/smartbft/network'; ./network.sh up createChannel -c smartbft"
& $gitBash -lc "$bashPrefix sleep 30"
& $gitBash -lc "$bashPrefix cd '$scriptDir/smartbft/network'; ./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl node -c smartbft"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Network startup failed!"
    exit $LASTEXITCODE
}
