# ==============================================================================
# Git Auto-Push Retry Script
# ==============================================================================
# Continuously attempts `git push origin staging/merged` every 10 minutes until
# GitHub accepts the push. Provides live timestamps, full error diagnostic logs,
# a live countdown timer, and pauses for user confirmation upon success.
# ==============================================================================

$repoDir = "D:\_awad work\invoice app\hulool-invoicing-staging"
$branch = "staging/merged"
$retryIntervalSeconds = 600 # 10 minutes

Set-Location -Path $repoDir
$Host.UI.RawUI.WindowTitle = "Git Push Retry Monitor - $branch"

Clear-Host
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " 🚀 Git Push Retry Monitor" -ForegroundColor Cyan
Write-Host " Repository : $repoDir" -ForegroundColor Gray
Write-Host " Target     : origin/$branch" -ForegroundColor Gray
Write-Host " Interval   : Every $($retryIntervalSeconds / 60) minutes" -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

$attempt = 1

while ($true) {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$now] (Attempt #$attempt) Initiating 'git push origin $branch'..." -ForegroundColor Yellow

    # Execute git push and capture stdout + stderr
    $pushOutput = & git push origin $branch 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "=================================================================" -ForegroundColor Green
        Write-Host " 🎉 SUCCESS! Commit pushed successfully to origin/$branch!" -ForegroundColor Green
        Write-Host " Completed at : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
        Write-Host "=================================================================" -ForegroundColor Green
        Write-Host ""
        if ($pushOutput) {
            Write-Host "Git Output:" -ForegroundColor Gray
            $pushOutput | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
        }
        Write-Host ""

        # Audible alert if supported by terminal
        try { [Console]::Beep(1000, 400); [Console]::Beep(1500, 500) } catch {}

        # Prompt user to acknowledge and close
        Write-Host "Push completed successfully." -ForegroundColor Green
        $response = Read-Host "Click [Enter] or type 'done' to close this script"
        break
    } else {
        Write-Host ""
        Write-Host "-----------------------------------------------------------------" -ForegroundColor Red
        Write-Host " ❌ [$now] Push failed (Exit code: $exitCode)" -ForegroundColor Red
        Write-Host " Error Details from GitHub:" -ForegroundColor Red
        $pushOutput | ForEach-Object {
            Write-Host "   $_" -ForegroundColor Magenta
        }
        Write-Host "-----------------------------------------------------------------" -ForegroundColor Red
        Write-Host ""
        Write-Host "Will retry automatically in $($retryIntervalSeconds / 60) minutes..." -ForegroundColor Yellow

        # Live countdown timer so user sees it actively running
        for ($s = $retryIntervalSeconds; $s -gt 0; $s--) {
            $mins = [math]::Floor($s / 60)
            $secs = $s % 60
            $timeStr = "{0:D2}m {1:D2}s" -f $mins, $secs
            Write-Host -NoNewline "`r⏳ Next attempt in: $timeStr | Press Ctrl+C to stop monitor...  "
            Start-Sleep -Seconds 1
        }
        Write-Host ""
        Write-Host ""

        $attempt++
    }
}
