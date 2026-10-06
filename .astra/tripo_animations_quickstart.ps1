param(
  [Parameter(Mandatory = $true)][string]$RigTaskId,
  [Parameter(Mandatory = $true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$key = [Environment]::GetEnvironmentVariable('TRIPO_API_KEY')
if ([string]::IsNullOrWhiteSpace($key)) { throw 'TRIPO_API_KEY is not set.' }
$headers = @{ Authorization = "Bearer $key"; 'Content-Type' = 'application/json' }
$create = Invoke-RestMethod -Method Post -Uri 'https://openapi.tripo3d.ai/v3/animations/retarget' -Headers $headers -Body (@{
  input = $RigTaskId
  animations = @('preset:walk', 'preset:idle', 'preset:run')
} | ConvertTo-Json)
if ($create.code -ne 0 -or -not $create.data.task_id) { throw "Create failed: $($create.message)" }
$taskId = [string]$create.data.task_id
$deadline = (Get-Date).AddMinutes(12)
do {
  Start-Sleep -Seconds 3
  $q = Invoke-RestMethod -Method Get -Uri "https://openapi.tripo3d.ai/v3/tasks/$taskId" -Headers @{ Authorization = "Bearer $key" }
  $status = [string]$q.data.status
  if ($status -in @('failed','cancelled','banned','expired')) { throw "Task failed: $($q.data.error_message)" }
  if ((Get-Date) -gt $deadline) { throw 'Animation task timed out.' }
} until ($status -eq 'success')
$urls = @($q.data.output.model_urls)
if ($urls.Count -ne 3) { throw "Expected three output URLs, got $($urls.Count)." }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$names = @('walk','idle','run')
for ($i = 0; $i -lt 3; $i += 1) {
  Invoke-WebRequest -Uri ([string]$urls[$i]) -OutFile (Join-Path $OutputDirectory "$($names[$i]).glb")
}
@{ rig_task = $RigTaskId; animation_task = $taskId; assets = @('walk.glb','idle.glb','run.glb') } |
  ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'animation-result.json') -Encoding utf8
Write-Output 'Quick Start movement animations completed.'
