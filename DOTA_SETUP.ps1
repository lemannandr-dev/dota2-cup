param(
    [switch]$NoSeed
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[ OK ] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERR ] $msg" -ForegroundColor Red }

# Move to script directory
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Ensure .env exists; create minimal if missing
if (-not (Test-Path ".env")) {
    Write-Warn ".env не найден — создаю минимальный .env"
    @"
NEXTAUTH_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME="Media Game Cup"
NEXT_PUBLIC_DEFAULT_LOCALE=ru
NEXT_PUBLIC_SUPPORTED_LOCALES=ru,en

DATABASE_URL=postgresql://postgres:postgres@postgres2:5432/mediagame
DIRECT_DATABASE_URL=postgresql://postgres:postgres@postgres2:5432/mediagame

S3_ENDPOINT=http://minio2:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123
S3_BUCKET=media-game-cup

REDIS_URL=redis://redis2:6379

NODE_ENV=development
"@ | Out-File -Encoding UTF8 .env
    Write-Ok ".env создан"
} else {
    Write-Info ".env найден"
}

# Start docker compose
Write-Info "Запуск docker-compose (второй проект)..."
& docker-compose up -d --build | Out-Null
Write-Ok "Контейнеры запущены"

# Wait a bit for services
Write-Info "Ожидание инициализации сервисов..."
Start-Sleep -Seconds 8

# Run Prisma seed unless disabled
if (-not $NoSeed) {
    try {
        Write-Info "Выполняю seed..."
        & docker exec -i media-game-cup-web-2 sh -c "npm run prisma:seed" | Out-Null
        Write-Ok "Seed выполнен"
    } catch {
        Write-Warn "Не удалось выполнить seed: $($_.Exception.Message)"
    }
} else {
    Write-Info "Seed пропущен по флагу --NoSeed"
}

# Open browser
$Url = "http://localhost:3001"
Write-Info "Открываю $Url"
Start-Process $Url | Out-Null
Write-Ok "Готово"













