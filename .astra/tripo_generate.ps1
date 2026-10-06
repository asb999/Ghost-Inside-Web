param(
  [Parameter(Mandatory = $true)][string]$InputImage,
  [Parameter(Mandatory = $true)][string]$OutputModel,
  [Parameter(Mandatory = $true)][string]$OutputPreview
)

$ErrorActionPreference = 'Stop'
$apiKey = [Environment]::GetEnvironmentVariable('TRIPO_API_KEY')
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw 'TRIPO_API_KEY is not set.' }

$baseUrl = 'https://openapi.tripo3d.ai/v3'
$auth = @{ Authorization = "Bearer $apiKey" }
$upload = Invoke-RestMethod -Method Post -Uri "$baseUrl/files" -Headers $auth -Form @{ file = Get-Item -LiteralPath $InputImage }
if ($upload.code -ne 0 -or -not $upload.data.file_token) { throw "Upload failed: code=$($upload.code)" }

$headers = @{ Authorization = "Bearer $apiKey"; 'Content-Type' = 'application/json' }
$body = @{
  input = $upload.data.file_token
  model = 'P1-20260311'
  face_limit = 4000
  texture = $true
  pbr = $true
  texture_quality = 'standard'
  enable_image_autofix = $true
  auto_size = $true
} | ConvertTo-Json
$create = Invoke-RestMethod -Method Post -Uri "$baseUrl/generation/image-to-model" -Headers $headers -Body $body
if ($create.code -ne 0 -or -not $create.data.task_id) { throw "Generation request failed: code=$($create.code)" }
$taskId = $create.data.task_id
Write-Output "Tripo task created: $taskId"

$deadline = (Get-Date).AddMinutes(8)
do {
  Start-Sleep -Seconds 2
  $query = Invoke-RestMethod -Method Get -Uri "$baseUrl/tasks/$taskId" -Headers $auth
  if ($query.code -ne 0) { throw "Task query failed: code=$($query.code)" }
  $status = [string]$query.data.status
  $progress = [int]($query.data.progress ?? 0)
  Write-Output "Tripo task: $status $progress%"
  if ($status -in @('failed', 'cancelled', 'banned', 'expired')) { throw "Tripo task ended with status: $status" }
  if ((Get-Date) -gt $deadline) { throw 'Tripo task timed out after 8 minutes.' }
} until ($status -eq 'success')

$modelUrl = [string]$query.data.output.model_url
$previewUrl = [string]$query.data.output.rendered_image_url
if ([string]::IsNullOrWhiteSpace($modelUrl)) { throw 'Tripo result does not contain model_url.' }
Invoke-WebRequest -Uri $modelUrl -OutFile $OutputModel
if (-not [string]::IsNullOrWhiteSpace($previewUrl)) { Invoke-WebRequest -Uri $previewUrl -OutFile $OutputPreview }

$model = Get-Item -LiteralPath $OutputModel
if ($model.Length -lt 1024) { throw "Downloaded GLB is too small: $($model.Length) bytes" }
Write-Output "Tripo model saved: $($model.FullName) ($($model.Length) bytes)"
