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

$jqCmd = Get-Command jq -ErrorAction SilentlyContinue
if ($jqCmd) {
    $jqDir = Split-Path $jqCmd.Source
    $jqDirBash = Convert-ToBashPath $jqDir
    $bashPrefix = 'export PATH="' + $jqDirBash + ':$PATH";'
} else {
    $bashPrefix = ""
}

& $gitBash -lc "$bashPrefix cd '$scriptDir/raft/network'; ./network.sh down"
& $gitBash -lc "$bashPrefix cd '$scriptDir/smartbft/network'; ./network.sh down"
