param(
  [Parameter(Mandatory = $true)][string]$InputImage,
  [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$apiKey = [Environment]::GetEnvironmentVariable('TRIPO_API_KEY')
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw 'TRIPO_API_KEY is not set.' }

$baseUrl = 'https://openapi.tripo3d.ai/v3'
$auth = @{ Authorization = "Bearer $apiKey" }
$jsonHeaders = @{ Authorization = "Bearer $apiKey"; 'Content-Type' = 'application/json' }
$terminalFailures = @('failed', 'cancelled', 'banned', 'expired')
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function Start-Task([string]$Endpoint, [hashtable]$Payload) {
  $response = Invoke-RestMethod -Method Post -Uri "$baseUrl/$Endpoint" -Headers $jsonHeaders -Body ($Payload | ConvertTo-Json -Depth 8)
  if ($response.code -ne 0 -or [string]::IsNullOrWhiteSpace([string]$response.data.task_id)) {
    throw "$Endpoint request failed: code=$($response.code) message=$($response.message)"
  }
  return [string]$response.data.task_id
}

function Wait-Task([string]$TaskId, [int]$TimeoutMinutes = 12) {
  $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  do {
    Start-Sleep -Seconds 3
    $query = Invoke-RestMethod -Method Get -Uri "$baseUrl/tasks/$TaskId" -Headers $auth
    if ($query.code -ne 0) { throw "Task query failed: code=$($query.code)" }
    $status = [string]$query.data.status
    $progress = 0
    if ($null -ne $query.data.progress) { $progress = [int]$query.data.progress }
    Write-Output "$TaskId $status $progress%"
    if ($terminalFailures -contains $status) { throw "Task $TaskId ended with status $status" }
    if ((Get-Date) -gt $deadline) { throw "Task $TaskId timed out." }
  } until ($status -eq 'success')
  return $query.data
}

function Save-Url([string]$Url, [string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Url)) { throw "Missing download URL for $Path" }
  Invoke-WebRequest -Uri $Url -OutFile $Path
  $file = Get-Item -LiteralPath $Path
  if ($file.Length -lt 102400) { throw "Downloaded asset is too small: $Path ($($file.Length) bytes)" }
}

Write-Output 'Uploading A-pose reference...'
$upload = Invoke-RestMethod -Method Post -Uri "$baseUrl/files" -Headers $auth -Form @{ file = Get-Item -LiteralPath $InputImage }
if ($upload.code -ne 0 -or -not $upload.data.file_token) { throw "Upload failed: code=$($upload.code)" }

Write-Output 'Generating formal character model...'
$generationId = Start-Task 'generation/image-to-model' @{
  input = [string]$upload.data.file_token
  model = 'P1-20260311'
  face_limit = 12000
  texture = $true
  pbr = $true
  texture_quality = 'standard'
  enable_image_autofix = $true
  auto_size = $true
}
$generation = Wait-Task $generationId 15
Save-Url ([string]$generation.output.model_url) (Join-Path $OutputDirectory 'lin-che-static.glb')
if (-not [string]::IsNullOrWhiteSpace([string]$generation.output.rendered_image_url)) {
  Invoke-WebRequest -Uri ([string]$generation.output.rendered_image_url) -OutFile (Join-Path $OutputDirectory 'lin-che-preview.png')
}

Write-Output 'Checking riggability...'
$checkId = Start-Task 'animations/rig-check' @{ input = $generationId }
$check = Wait-Task $checkId 8
if (-not [bool]$check.output.riggable) {
  @{ generation_task = $generationId; rig_check_task = $checkId; riggable = $false; rig_type = [string]$check.output.rig_type } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDirectory 'pipeline-result.json') -Encoding utf8
  throw 'Generated character is not riggable. Stopped before rigging and animation.'
}
if ([string]$check.output.rig_type -ne 'biped') { throw "Unexpected rig type: $($check.output.rig_type)" }

Write-Output 'Rigging character...'
$rigId = Start-Task 'animations/rig' @{
  input = $generationId
  model = 'v1.0-20240301'
  rig_type = 'biped'
  spec = 'mixamo'
  out_format = 'glb'
}
$rig = Wait-Task $rigId 15
Save-Url ([string]$rig.output.model_url) (Join-Path $OutputDirectory 'lin-che-rigged.glb')

$baseAnimations = @(
  'preset:biped:idle',
  'preset:biped:run',
  'preset:biped:jump',
  'preset:biped:fall',
  'preset:biped:jump_down'
)
Write-Output 'Generating movement animations...'
$moveId = Start-Task 'animations/retarget' @{
  input = $rigId
  animations = $baseAnimations
  out_format = 'glb'
  bake_animation = $true
  export_with_geometry = $true
  animate_in_place = $true
}
$move = Wait-Task $moveId 15
$moveUrls = @()
if ($null -ne $move.output.model_urls) { $moveUrls = @($move.output.model_urls) }
elseif (-not [string]::IsNullOrWhiteSpace([string]$move.output.model_url)) { $moveUrls = @([string]$move.output.model_url) }
if ($moveUrls.Count -ne 5) { throw "Expected 5 movement animation files, got $($moveUrls.Count)." }
$moveNames = @('idle', 'run', 'jump', 'fall', 'land')
for ($i = 0; $i -lt $moveNames.Count; $i += 1) {
  Save-Url ([string]$moveUrls[$i]) (Join-Path $OutputDirectory "$($moveNames[$i]).glb")
}

Write-Output 'Generating interaction animation...'
$interactId = Start-Task 'animations/retarget' @{
  input = $rigId
  animation = 'preset:biped:lift_heavy'
  out_format = 'glb'
  bake_animation = $true
  export_with_geometry = $true
  animate_in_place = $true
}
$interact = Wait-Task $interactId 15
Save-Url ([string]$interact.output.model_url) (Join-Path $OutputDirectory 'interact.glb')

$result = @{
  generation_task = $generationId
  rig_check_task = $checkId
  rig_task = $rigId
  movement_task = $moveId
  interaction_task = $interactId
  riggable = $true
  rig_type = 'biped'
  assets = @('lin-che-rigged.glb', 'idle.glb', 'run.glb', 'jump.glb', 'fall.glb', 'land.glb', 'interact.glb')
}
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'pipeline-result.json') -Encoding utf8
Write-Output 'Character pipeline completed.'
