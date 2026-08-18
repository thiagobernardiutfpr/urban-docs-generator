[CmdletBinding()]
param(
  [string]$ProjectRoot = "",
  [string]$DbPassword = "",
  [string]$AppPassword = "",
  [switch]$UseExistingMySql,
  [switch]$ForceEnv,
  [switch]$StartApp,
  [string]$SpatialSourcePath = "",
  [string]$TerritorialCadastroPath = "",
  [string]$TerritorialNumeracaoPath = "",
  [string]$TerritorialZoneamentoPath = ""
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Comando não encontrado: $Name. Instale-o ou use a alternativa indicada."
  }
}

function Read-Secret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Get-ComposeMode {
  if (Get-Command docker -ErrorAction SilentlyContinue) {
    & docker compose version *> $null
    if ($LASTEXITCODE -eq 0) { return "docker compose" }
  }
  if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    & docker-compose version *> $null
    if ($LASTEXITCODE -eq 0) { return "docker-compose" }
  }
  return ""
}

function Invoke-Compose([string[]]$Arguments) {
  if ($script:ComposeMode -eq "docker compose") {
    & docker compose @Arguments
  } else {
    & docker-compose @Arguments
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar Docker Compose: $($Arguments -join ' ')"
  }
}

function Invoke-MySql([string]$Sql) {
  $oldPwd = $env:MYSQL_PWD
  try {
    if ($script:DbMode -eq "docker") {
      if ($script:RootPasswordMode -eq "password") {
        $mysqlPasswordEnv = "MYSQL_PWD=$($script:DbPassword)"
        & docker exec -e $mysqlPasswordEnv $script:ContainerName mysql -uroot -e $Sql
      } else {
        & docker exec $script:ContainerName mysql -uroot -e $Sql
      }
    } else {
      $env:MYSQL_PWD = $script:DbPassword
      & mysql -h 127.0.0.1 -P 3306 -uroot -e $Sql
    }
    if ($LASTEXITCODE -ne 0) { throw "O cliente MySQL recusou a operação." }
  } finally {
    if ($null -eq $oldPwd) { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
    else { $env:MYSQL_PWD = $oldPwd }
  }
}

function Wait-ForMySqlContainer {
  Write-Step "Aguardando o MySQL ficar pronto"
  for ($i = 1; $i -le 60; $i++) {
    $status = (& docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $script:ContainerName 2>$null).Trim()
    if ($status -eq "healthy" -or $status -eq "running") { return }
    if ($status -eq "exited" -or $status -eq "dead") {
      throw "O container MySQL terminou inesperadamente. Verifique: docker logs $script:ContainerName"
    }
    Start-Sleep -Seconds 2
  }
  throw "O MySQL não ficou pronto em 120 segundos. Verifique: docker logs $script:ContainerName"
}

function Configure-RootPassword {
  Write-Step "Validando a senha root do MySQL local"
  $oldPwd = $env:MYSQL_PWD
  try {
    $mysqlPasswordEnv = "MYSQL_PWD=$($script:DbPassword)"
    & docker exec -e $mysqlPasswordEnv $script:ContainerName mysql -uroot -e "SELECT 1;" *> $null
    if ($LASTEXITCODE -eq 0) {
      $script:RootPasswordMode = "password"
      return
    }

    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    & docker exec $script:ContainerName mysql -uroot -e "SELECT 1;" *> $null
    if ($LASTEXITCODE -ne 0) {
      throw "Não foi possível autenticar no MySQL com a senha informada nem sem senha. Se o container já existia, informe a senha original do root."
    }

    $escapedRootPassword = $script:DbPassword.Replace("'", "''")
    $sql = "ALTER USER 'root'@'localhost' IDENTIFIED BY '$escapedRootPassword'; FLUSH PRIVILEGES;"
    & docker exec $script:ContainerName mysql -uroot -e $sql
    if ($LASTEXITCODE -ne 0) { throw "O MySQL aceitou root sem senha, mas não foi possível definir a nova senha." }
    $script:RootPasswordMode = "password"
  } finally {
    if ($null -eq $oldPwd) { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
    else { $env:MYSQL_PWD = $oldPwd }
  }
}

if (-not $ProjectRoot) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
} else {
  $ProjectRoot = (Resolve-Path $ProjectRoot).Path
}

Set-Location $ProjectRoot
$script:ContainerName = "urban-docs-mysql"
$script:ComposeMode = Get-ComposeMode
$script:DbMode = ""
$script:RootPasswordMode = "password"

Write-Step "Verificando o projeto em $ProjectRoot"
Require-Command pnpm
if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
  throw "package.json não foi encontrado. Execute o script na cópia do Urban Docs."
}

$localStorageDir = Join-Path $ProjectRoot "data\storage"
$spatialDir = Join-Path $ProjectRoot "data\spatial"
$defaultSpatialPath = Join-Path $spatialDir "GEOPACKAGE_22-10-25.gpkg"
$defaultTerritorialCadastroPath = Join-Path $spatialDir "Lotes-cadastro.xlsx"
$defaultTerritorialNumeracaoPath = Join-Path $spatialDir "Lotes-NumQgis.xlsx"
$defaultTerritorialZoneamentoPath = Join-Path $spatialDir "LotesxZoneamento.xlsx"
if (-not $SpatialSourcePath -and (Test-Path $defaultSpatialPath)) { $SpatialSourcePath = $defaultSpatialPath }
if (-not $TerritorialCadastroPath -and (Test-Path $defaultTerritorialCadastroPath)) { $TerritorialCadastroPath = $defaultTerritorialCadastroPath }
if (-not $TerritorialNumeracaoPath -and (Test-Path $defaultTerritorialNumeracaoPath)) { $TerritorialNumeracaoPath = $defaultTerritorialNumeracaoPath }
if (-not $TerritorialZoneamentoPath -and (Test-Path $defaultTerritorialZoneamentoPath)) { $TerritorialZoneamentoPath = $defaultTerritorialZoneamentoPath }
if ($SpatialSourcePath) {
  $SpatialSourcePath = (Resolve-Path $SpatialSourcePath).Path
  if (-not $SpatialSourcePath.ToLowerInvariant().EndsWith(".gpkg")) { throw "SpatialSourcePath deve apontar para um arquivo .gpkg." }
  Write-Host "GeoPackage local configurado: $SpatialSourcePath" -ForegroundColor Green
} else {
  Write-Host "Nenhum GeoPackage local foi encontrado. O app funcionará sem a base territorial até LOCAL_SPATIAL_SOURCE_PATH ser configurado." -ForegroundColor Yellow
}

$territorialPaths = @(
  @{ Name = "TerritorialCadastroPath"; Value = $TerritorialCadastroPath; Label = "Lotes-cadastro.xlsx" },
  @{ Name = "TerritorialNumeracaoPath"; Value = $TerritorialNumeracaoPath; Label = "Lotes-NumQgis.xlsx" },
  @{ Name = "TerritorialZoneamentoPath"; Value = $TerritorialZoneamentoPath; Label = "LotesxZoneamento.xlsx" }
)
foreach ($item in $territorialPaths) {
  if ($item.Value) {
    $resolved = (Resolve-Path $item.Value).Path
    if (-not $resolved.ToLowerInvariant().EndsWith(".xlsx")) { throw "$($item.Name) deve apontar para um arquivo .xlsx." }
    Set-Variable -Name $item.Name -Value $resolved
    Write-Host "Tabela territorial configurada ($($item.Label)): $resolved" -ForegroundColor Green
  }
}
New-Item -ItemType Directory -Force $localStorageDir | Out-Null

if (-not $DbPassword) {
  $DbPassword = Read-Secret "Senha atual ou nova do usuário root do MySQL local (não será exibida)"
}
if (-not $AppPassword) {
  $AppPassword = Read-Secret "Defina a senha do usuário local urban_docs_app (não será exibida)"
}
if (-not $DbPassword -or -not $AppPassword) {
  throw "As senhas não podem ficar vazias."
}
if ($AppPassword -match "['\\\s]") {
  throw "Use para a senha de urban_docs_app somente letras, números, ponto, hífen, sublinhado ou @. Não use espaço, apóstrofo ou barra invertida."
}

if ($UseExistingMySql) {
  Write-Step "Usando um MySQL já instalado no Windows"
  Require-Command mysql
  $script:DbMode = "local"
  $script:RootPasswordMode = "password"
} else {
  if (-not $script:ComposeMode) {
    throw "Docker Desktop com Docker Compose não foi encontrado. Instale o Docker Desktop ou execute novamente com -UseExistingMySql após instalar o MySQL local."
  }

  Write-Step "Criando ou iniciando o MySQL local em um container"
  $composeFile = Join-Path $ProjectRoot "docker-compose.local.yml"
  if (-not (Test-Path $composeFile)) {
    @"
services:
  mysql:
    image: mysql:8.4
    container_name: urban-docs-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: `${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: urban_docs
      MYSQL_USER: urban_docs_app
      MYSQL_PASSWORD: `${MYSQL_APP_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - urban_docs_mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot"]
      interval: 5s
      timeout: 5s
      retries: 30

volumes:
  urban_docs_mysql_data:
"@ | Set-Content -Path $composeFile -Encoding UTF8
    Write-Host "Arquivo criado: $composeFile"
  }

  $env:MYSQL_ROOT_PASSWORD = $DbPassword
  $env:MYSQL_APP_PASSWORD = $AppPassword
  try {
    Invoke-Compose @("-f", $composeFile, "up", "-d", "mysql")
  } finally {
    Remove-Item Env:MYSQL_ROOT_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:MYSQL_APP_PASSWORD -ErrorAction SilentlyContinue
  }
  $script:DbMode = "docker"

  Wait-ForMySqlContainer
  Configure-RootPassword
}

Write-Step "Criando o banco e o usuário da aplicação"
$escapedAppPassword = $AppPassword.Replace("'", "''")
$sql = @"
CREATE DATABASE IF NOT EXISTS urban_docs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'urban_docs_app'@'%' IDENTIFIED BY '$escapedAppPassword';
ALTER USER 'urban_docs_app'@'%' IDENTIFIED BY '$escapedAppPassword';
GRANT ALL PRIVILEGES ON urban_docs.* TO 'urban_docs_app'@'%';
FLUSH PRIVILEGES;
"@
Invoke-MySql $sql

$encodedPassword = [Uri]::EscapeDataString($AppPassword)
$databaseUrl = "mysql://urban_docs_app:$encodedPassword@127.0.0.1:3306/urban_docs"
$jwtBytes = New-Object byte[] 32
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
try {
  $rng.GetBytes($jwtBytes)
} finally {
  $rng.Dispose()
}
$jwtSecret = -join ($jwtBytes | ForEach-Object { $_.ToString("x2") })
$envFile = Join-Path $ProjectRoot ".env"

Write-Step "Configurando o ambiente local"
$localStorageDirForEnv = ($localStorageDir -replace "\\", "/")
$spatialSourcePathForEnv = if ($SpatialSourcePath) { ($SpatialSourcePath -replace "\\", "/") } else { "" }
$territorialCadastroPathForEnv = if ($TerritorialCadastroPath) { ($TerritorialCadastroPath -replace "\\", "/") } else { "" }
$territorialNumeracaoPathForEnv = if ($TerritorialNumeracaoPath) { ($TerritorialNumeracaoPath -replace "\\", "/") } else { "" }
$territorialZoneamentoPathForEnv = if ($TerritorialZoneamentoPath) { ($TerritorialZoneamentoPath -replace "\\", "/") } else { "" }

if ((Test-Path $envFile) -and -not $ForceEnv) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  Copy-Item $envFile "$envFile.backup-$stamp"
  Write-Host "O .env existente foi preservado em .env.backup-$stamp"
}
if ((-not (Test-Path $envFile)) -or $ForceEnv) {
  @"
NODE_ENV=development
PORT=3000
DATABASE_URL=$databaseUrl
JWT_SECRET=$jwtSecret
LOCAL_STORAGE_DIR=$localStorageDirForEnv
LOCAL_SPATIAL_SOURCE_PATH=$spatialSourcePathForEnv
LOCAL_SPATIAL_SOURCE_NAME=GeoPackage territorial local
LOCAL_TERRITORIAL_CADASTRO_PATH=$territorialCadastroPathForEnv
LOCAL_TERRITORIAL_NUMERACAO_PATH=$territorialNumeracaoPathForEnv
LOCAL_TERRITORIAL_ZONEAMENTO_PATH=$territorialZoneamentoPathForEnv
"@ | Set-Content -Path $envFile -Encoding UTF8
  Write-Host "Arquivo .env local configurado. Ele é ignorado pelo Git."
} else {
  Write-Host "O .env existente foi mantido. Verifique se DATABASE_URL aponta para 127.0.0.1:3306/urban_docs."
}

Write-Step "Instalando dependências e aplicando o esquema Drizzle"
pnpm install --frozen-lockfile
$oldDatabaseUrl = $env:DATABASE_URL
$oldNodeEnv = $env:NODE_ENV
$env:DATABASE_URL = $databaseUrl
$env:NODE_ENV = "development"
try {
  pnpm db:push
  if ($LASTEXITCODE -ne 0) { throw "pnpm db:push falhou." }
} finally {
  if ($null -eq $oldDatabaseUrl) { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue } else { $env:DATABASE_URL = $oldDatabaseUrl }
  if ($null -eq $oldNodeEnv) { Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue } else { $env:NODE_ENV = $oldNodeEnv }
}

Write-Host "`nBanco local configurado com sucesso." -ForegroundColor Green
Write-Host "DATABASE_URL: mysql://urban_docs_app:<senha>@127.0.0.1:3306/urban_docs"
Write-Host "Para iniciar o aplicativo: pnpm dev"
Write-Host "Acesse: http://localhost:3000/"

if ($StartApp) {
  Write-Step "Iniciando o Urban Docs"
  pnpm dev
}
