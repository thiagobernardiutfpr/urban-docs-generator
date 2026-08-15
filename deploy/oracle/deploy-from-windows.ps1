[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F:.]+$')]
  [string]$VmIp,

  [string]$KeyPath = "$env:USERPROFILE\.ssh\urban_docs_oracle",
  [string]$RemoteUser = "opc"
)

$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $PSScriptRoot "provision-and-deploy.sh"
$remoteScript = "/tmp/urban-docs-provision-and-deploy.sh"
$target = "${RemoteUser}@${VmIp}"

if (-not (Test-Path -LiteralPath $KeyPath -PathType Leaf)) {
  throw "Chave SSH não encontrada: $KeyPath"
}

if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
  throw "Script remoto não encontrado: $scriptPath"
}

Write-Host "Enviando o script para $target ..."
& scp -o ConnectTimeout=30 -i $KeyPath $scriptPath "${target}:${remoteScript}"
if ($LASTEXITCODE -ne 0) {
  throw "O envio do script via SCP falhou com código $LASTEXITCODE."
}

Write-Host "Executando o provisionamento na VM. Os segredos serão solicitados no terminal remoto."
$remoteCommand = "sed -i 's/\r`$//' $remoteScript && sudo bash $remoteScript"
& ssh -tt -o ConnectTimeout=30 -o StrictHostKeyChecking=accept-new -i $KeyPath $target $remoteCommand
if ($LASTEXITCODE -ne 0) {
  throw "O deploy remoto falhou com código $LASTEXITCODE. Consulte os logs indicados pelo script."
}
