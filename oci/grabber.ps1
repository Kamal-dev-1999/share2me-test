# ─── OCI ARM Always-Free Auto-Claimer & Capacity Grabber ─────────────────────
# Retries every 5 seconds until the ARM Ampere VM is claimed.
# Once claimed, it AUTOMATICALLY attaches the permanent Reserved Public IP,
# starts Caddy + Docker, and finishes the complete deployment without human action.

$ErrorActionPreference = "Continue"
$terraformDir = "d:\Downloads\ShareIt\oci\terraform"
Set-Location $terraformDir

$attempt = 1
$sleepSeconds = 5

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " OCI Mumbai ARM Auto-Claimer Active" -ForegroundColor Green
Write-Host " Target: VM.Standard.A1.Flex (2 OCPUs, 12 GB RAM, 100GB Boot)" -ForegroundColor Yellow
Write-Host " Status: Autonomous Claiming Mode" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

while ($true) {
    $time = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host "[$time] [Attempt #$attempt] Requesting ARM host capacity..." -ForegroundColor White

    # Request the VM directly from OCI
    $output = & terraform apply "-target=oci_core_instance.app_server" -auto-approve 2>&1 | Out-String

    if ($output -match "Creation complete" -or $output -match "Apply complete!") {
        Write-Host "`n🎉🎉🎉 [SUCCESS] ARM CAPACITY CLAIMED AT $time! 🎉🎉🎉" -ForegroundColor Green
        Write-Host "Automatically attaching Reserved Static Public IP and finalizing all infrastructure..." -ForegroundColor Cyan

        # Automatically claim and bind the reserved static IP
        & terraform apply -auto-approve

        Write-Host "`n✅ SERVER CLAIMED & FULLY PROVISIONED!" -ForegroundColor Green
        & terraform output
        break
    }
    elseif ($output -match "Out of host capacity") {
        Write-Host "   -> Free capacity pool full. Retrying in $sleepSeconds seconds..." -ForegroundColor DarkGray
    }
    elseif ($output -match "429-TooManyRequests") {
        Write-Host "   ⚠️ Rate limited (429). Pausing 20s..." -ForegroundColor Red
        Start-Sleep -Seconds 20
    }
    else {
        # Check if already provisioned
        if ($output -match "0 to add, 0 to change, 0 to destroy") {
            Write-Host "`n🎉 Instance already provisioned! Finalizing outputs..." -ForegroundColor Green
            & terraform apply -auto-approve
            break
        }
        Write-Host "   -> Notice: $($output.Trim().Split("`n")[-1])" -ForegroundColor Yellow
    }

    $attempt++
    Start-Sleep -Seconds $sleepSeconds
}
