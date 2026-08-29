# Test script: modify a dataset file and verify Python/Java/Node servers pick up change
param(
  [string] $Field = 'altitude',
  [string] $Dataset = 'iss',
  [string] $NewValue = '999.9'
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$datasetFile = Join-Path $root '..\src\data-files\' + "$Dataset.json"
$datasetFile = (Resolve-Path $datasetFile).Path
Write-Output "Dataset file: $datasetFile"

# Backup
$backup = "$datasetFile.bak"
Copy-Item -Path $datasetFile -Destination $backup -Force

# Load, modify, save
$json = Get-Content $datasetFile -Raw | ConvertFrom-Json
$json.$Field = [double]::Parse($NewValue)
$json | ConvertTo-Json -Depth 10 | Set-Content -Path $datasetFile -Encoding UTF8
Write-Output "Wrote new $Field = $NewValue to $Dataset.json"

Start-Sleep -Seconds 1

# Probe endpoints
$python = Invoke-RestMethod -Uri 'http://127.0.0.1:5001/api/telemetry/live' -Method Get -ErrorAction SilentlyContinue
$java = Invoke-RestMethod -Uri 'http://127.0.0.1:5002/api/telemetry/live' -Method Get -ErrorAction SilentlyContinue
$node = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/telemetry/live' -Method Get -ErrorAction SilentlyContinue

Write-Output "--- Python telemetry (altitude) ---"
if ($python) { $python.data.orbit } else { Write-Output 'no python response' }

Write-Output "--- Java telemetry (altitude) ---"
if ($java) { $java.lastUpdated; $java.orbit } else { Write-Output 'no java response' }

Write-Output "--- Node telemetry (orbit) ---"
if ($node) { $node.orbit } else { Write-Output 'no node response' }

# Restore original file
Move-Item -Path $backup -Destination $datasetFile -Force
Write-Output 'Restored original dataset file'
