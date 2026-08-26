# setup-github-runner.ps1
# Jalankan sebagai Administrator di server Windows
# Script ini menginstall GitHub Actions self-hosted runner sebagai Windows Service
#
# CARA PAKAI:
# 1. Buka PowerShell sebagai Administrator
# 2. cd ke folder ini
# 3. .\setup-github-runner.ps1 -Token "RUNNER_TOKEN_DARI_GITHUB"
#
# Dapatkan token di:
# GitHub repo -> Settings -> Actions -> Runners -> New self-hosted runner

param(
    [Parameter(Mandatory=$true)]
    [string]$Token,

    [string]$RunnerDir = "C:\actions-runner",
    [string]$RepoUrl = "https://github.com/bhayuprakasa/CCSI-Sertifikasi-Training"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Setup GitHub Actions Self-Hosted Runner ===" -ForegroundColor Cyan

# Buat folder runner
if (-not (Test-Path $RunnerDir)) {
    New-Item -ItemType Directory -Path $RunnerDir | Out-Null
    Write-Host "Folder dibuat: $RunnerDir"
}

Set-Location $RunnerDir

# Download runner versi terbaru
$apiUrl = "https://api.github.com/repos/actions/runner/releases/latest"
Write-Host "Mengambil versi runner terbaru..."
$release = Invoke-RestMethod -Uri $apiUrl
$asset = $release.assets | Where-Object { $_.name -match "win-x64" -and $_.name -match "\.zip$" }
$downloadUrl = $asset.browser_download_url
$zipFile = "$RunnerDir\runner.zip"

Write-Host "Download: $($asset.name)"
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile
Expand-Archive -Path $zipFile -DestinationPath $RunnerDir -Force
Remove-Item $zipFile

# Konfigurasi runner
Write-Host "`nMengkonfigurasi runner..." -ForegroundColor Yellow
& "$RunnerDir\config.cmd" `
    --url $RepoUrl `
    --token $Token `
    --name "windows-server-ccsi" `
    --labels "self-hosted,Windows,ccsi-production" `
    --work "_work" `
    --unattended `
    --replace

# Install sebagai Windows Service agar otomatis jalan saat server restart
Write-Host "`nInstall sebagai Windows Service..." -ForegroundColor Yellow
& "$RunnerDir\svc.cmd" install
& "$RunnerDir\svc.cmd" start

Write-Host "`n=== Runner berhasil diinstall dan berjalan ===" -ForegroundColor Green
Write-Host "Runner akan otomatis jalan saat Windows restart."
Write-Host "Cek status: $RunnerDir\svc.cmd status"
