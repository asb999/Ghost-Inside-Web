param(
  [Parameter(Mandatory = $true)][string]$RigTaskId,
  [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$apiKey = [Environment]::GetEnvironmentVariable('TRIPO_API_KEY')
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw 'TRIPO_API_KEY is not set.' }
$baseUrl = 'https://openapi.tripo3d.ai/v3'
$auth = @{ Authorization = "Bearer $apiKey" }
$headers = @{ Authorization = "Bearer $apiKey"; 'Content-Type' = 'application/json' }
$failed = @('failed', 'cancelled', 'banned', 'expired')
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function Wait-Task([string]$TaskId) {
  $deadline = (Get-Date).AddMinutes(12)
  do {
    Start-Sleep -Seconds 3
    $q = Invoke-RestMethod -Method Get -Uri "$baseUrl/tasks/$TaskId" -Headers $auth
    $status = [string]$q.data.status
    if ($failed -contains $status) { throw "Task $TaskId failed: $($q.data.error_message)" }
    if ((Get-Date) -gt $deadline) { throw "Task $TaskId timed out." }
  } until ($status -eq 'success')
  return $q.data
}

$presets = [ordered]@{
  idle = 'preset:idle'
  run = 'preset:run'
  jump = 'preset:jump'
  fall = 'preset:fall'
}
$taskIds = [ordered]@{}
foreach ($entry in $presets.GetEnumerator()) {
  Write-Output "Generating $($entry.Key)..."
  $payload = @{
    input = $RigTaskId
    animation = [string]$entry.Value
  } | ConvertTo-Json
  $create = Invoke-RestMethod -Method Post -Uri "$baseUrl/animations/retarget" -Headers $headers -Body $payload
  if ($create.code -ne 0 -or -not $create.data.task_id) { throw "Unable to start $($entry.Key): $($create.message)" }
  $taskId = [string]$create.data.task_id
  $taskIds[$entry.Key] = $taskId
  $result = Wait-Task $taskId
  $url = [string]$result.output.model_url
  if ([string]::IsNullOrWhiteSpace($url)) { throw "No model URL returned for $($entry.Key)." }
  $path = Join-Path $OutputDirectory "$($entry.Key).glb"
  Invoke-WebRequest -Uri $url -OutFile $path
  if ((Get-Item -LiteralPath $path).Length -lt 102400) { throw "Downloaded animation is too small: $path" }
}

@{ rig_task = $RigTaskId; animation_tasks = $taskIds; assets = @($presets.Keys | ForEach-Object { "$_.glb" }) } |
  ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'animation-result.json') -Encoding utf8
Write-Output 'All character animations completed.'
