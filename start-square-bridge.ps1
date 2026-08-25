param(
  [switch]$Setup
)

$ErrorActionPreference = "Stop"
$appFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $appFolder ".env"

function Read-ExistingSettings {
  $settings = [ordered]@{}

  if (Test-Path $envFile) {
    Get-Content -LiteralPath $envFile | ForEach-Object {
      $line = $_.Trim()
      if (-not $line -or $line.StartsWith("#")) { return }

      $equalIndex = $line.IndexOf("=")
      if ($equalIndex -lt 1) { return }

      $key = $line.Substring(0, $equalIndex).Trim()
      $value = $line.Substring($equalIndex + 1).Trim()
      if ($key) {
        $settings[$key] = $value
      }
    }
  }

  return $settings
}

function Save-AllSettings($settings) {
  $lines = @()
  foreach ($key in $settings.Keys) {
    if (-not [string]::IsNullOrWhiteSpace($settings[$key])) {
      $lines += "$key=$($settings[$key])"
    }
  }

  Set-Content -LiteralPath $envFile -Value $lines -Encoding UTF8
}

if ($Setup -or -not (Test-Path $envFile)) {
  Write-Host ""
  Write-Host "Square setup."
  Write-Host "Important: Device ID means the paired Square Terminal API device id, not the serial number on the bottom."
  Write-Host "The token will be hidden while you type/paste."
  Write-Host ""

  $settings = Read-ExistingSettings

  $tokenSecure = Read-Host "Square Access Token (press Enter to keep saved token)" -AsSecureString
  $tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenSecure))
  if (-not [string]::IsNullOrWhiteSpace($tokenPlain)) {
    $settings["SQUARE_ACCESS_TOKEN"] = $tokenPlain.Trim()
  }

  $deviceId = Read-Host "Square Terminal API Device ID"
  if (-not [string]::IsNullOrWhiteSpace($deviceId)) {
    $settings["SQUARE_DEVICE_ID"] = $deviceId.Trim()
  }

  $locationId = Read-Host "Square Location ID (optional, press Enter to skip)"
  if (-not [string]::IsNullOrWhiteSpace($locationId)) {
    $settings["SQUARE_LOCATION_ID"] = $locationId.Trim()
  }

  $settings["SQUARE_ENVIRONMENT"] = "production"
  Save-AllSettings $settings

  Write-Host ""
  Write-Host "Saved Square settings to .env"
  Write-Host "Token saved: $([bool]$settings['SQUARE_ACCESS_TOKEN'])"
  Write-Host "Device ID saved: $([bool]$settings['SQUARE_DEVICE_ID'])"
  Write-Host ""
}

Set-Location $appFolder
node square-bridge.js
