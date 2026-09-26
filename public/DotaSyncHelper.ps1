param(
	[string]$ServerUrl = 'http://localhost:3002',
	[string]$Code = '',
	[switch]$InspectOnly,
	[switch]$Confirm
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Find-SteamPath {
	$registryPaths = @(
		'HKCU:\Software\Valve\Steam',
		'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam'
	)
	foreach ($registryPath in $registryPaths) {
		if (Test-Path $registryPath) {
			$steamPath = (Get-ItemProperty -Path $registryPath -ErrorAction SilentlyContinue).SteamPath
			if ($steamPath -and (Test-Path $steamPath)) { return $steamPath }
		}
	}
	foreach ($candidate in @("${env:ProgramFiles(x86)}\Steam", "$env:ProgramFiles\Steam")) {
		if ($candidate -and (Test-Path $candidate)) { return $candidate }
	}
	return $null
}

function Find-DotaPath([string]$SteamPath) {
	if (-not $SteamPath) { return $null }
	$defaultPath = Join-Path $SteamPath 'steamapps\common\dota 2 beta'
	if (Test-Path $defaultPath) { return $defaultPath }

	$libraryFile = Join-Path $SteamPath 'steamapps\libraryfolders.vdf'
	if (-not (Test-Path $libraryFile)) { return $null }
	$libraryRoots = Select-String -Path $libraryFile -Pattern '"path"\s+"([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value.Replace('\\', '\') }
	foreach ($libraryRoot in $libraryRoots) {
		$candidate = Join-Path $libraryRoot 'steamapps\common\dota 2 beta'
		if (Test-Path $candidate) { return $candidate }
	}
	return $null
}

function Read-ProtoVarint([byte[]]$Buffer, [ref]$Offset) {
	[uint64]$value = 0
	$shift = 0
	while ($Offset.Value -lt $Buffer.Length) {
		$byte = $Buffer[$Offset.Value]
		$Offset.Value += 1
		$value = $value -bor (([uint64]($byte -band 0x7F)) -shl $shift)
		if (($byte -band 0x80) -eq 0) { return $value }
		$shift += 7
		if ($shift -gt 63) { throw 'Invalid protobuf varint' }
	}
	throw 'Unexpected end of protobuf'
}

function Read-ProtoFields([byte[]]$Buffer) {
	$offset = 0
	$fields = New-Object System.Collections.Generic.List[object]
	while ($offset -lt $Buffer.Length) {
		$key = Read-ProtoVarint $Buffer ([ref]$offset)
		$number = [int]($key -shr 3)
		$wire = [int]($key -band 7)
		if ($wire -eq 0) {
			$value = Read-ProtoVarint $Buffer ([ref]$offset)
			$fields.Add([pscustomobject]@{ Number = $number; Wire = $wire; Value = $value }) | Out-Null
		} elseif ($wire -eq 1) {
			if (($offset + 8) -gt $Buffer.Length) { throw 'Invalid protobuf fixed64' }
			$offset += 8
			$fields.Add([pscustomobject]@{ Number = $number; Wire = $wire; Value = $null }) | Out-Null
		} elseif ($wire -eq 2) {
			$length = [int](Read-ProtoVarint $Buffer ([ref]$offset))
			if (($offset + $length) -gt $Buffer.Length) { throw 'Invalid protobuf bytes' }
			$slice = New-Object byte[] $length
			[Array]::Copy($Buffer, $offset, $slice, 0, $length)
			$offset += $length
			$fields.Add([pscustomobject]@{ Number = $number; Wire = $wire; Value = $slice }) | Out-Null
		} elseif ($wire -eq 5) {
			if (($offset + 4) -gt $Buffer.Length) { throw 'Invalid protobuf fixed32' }
			$offset += 4
			$fields.Add([pscustomobject]@{ Number = $number; Wire = $wire; Value = $null }) | Out-Null
		} else {
			throw "Unsupported protobuf wire type $wire"
		}
	}
	return $fields
}

function Find-DotaSocCache([string]$DotaPath) {
	if (-not $DotaPath) { return $null }
	$cacheDir = Join-Path $DotaPath 'game\dota'
	if (-not (Test-Path $cacheDir)) { return $null }
	return Get-ChildItem -Path $cacheDir -File | Where-Object { $_.Name -match '^cache_\d+_1\.soc$' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

function Read-DotaSocCache([string]$CachePath) {
	$result = [ordered]@{
		cacheFound = $false
		cacheFileName = $null
		cacheAccountId = $null
		plusStatus = $null
		plusSubscriber = $false
		challengeCount = 0
		heroProgressPresent = $false
	}
	if (-not $CachePath -or -not (Test-Path $CachePath)) { return $result }

	$info = Get-Item $CachePath
	if ($info.Length -gt 8MB) { throw 'SO cache is unexpectedly large and was not read.' }

	$result.cacheFound = $true
	$result.cacheFileName = $info.Name
	if ($info.Name -match '^cache_(\d+)_1\.soc$') {
		$result.cacheAccountId = [int64]$Matches[1]
	}

	$bytes = [IO.File]::ReadAllBytes($CachePath)
	$root = Read-ProtoFields $bytes
	foreach ($field in $root) {
		if ($field.Number -ne 2 -or $field.Wire -ne 2) { continue }
		$cache = Read-ProtoFields $field.Value
		foreach ($cacheField in $cache) {
			if ($cacheField.Number -ne 4 -or $cacheField.Wire -ne 2) { continue }
			$typeCache = Read-ProtoFields $cacheField.Value
			$typeId = $null
			$objects = @()
			foreach ($typeField in $typeCache) {
				if ($typeField.Number -eq 1 -and $typeField.Wire -eq 0) { $typeId = [int]$typeField.Value }
				if ($typeField.Number -eq 2 -and $typeField.Wire -eq 2) { $objects += ,$typeField.Value }
			}
			if ($typeId -eq 2010) { $result.challengeCount = $objects.Count }
			if ($typeId -eq 2012 -and $objects.Count -gt 0) {
				$plus = Read-ProtoFields $objects[0]
				foreach ($plusField in $plus) {
					if ($plusField.Number -eq 1 -and $plusField.Wire -eq 0 -and -not $result.cacheAccountId) {
						$result.cacheAccountId = [int64]$plusField.Value
					}
					if ($plusField.Number -eq 4 -and $plusField.Wire -eq 0) {
						$result.plusStatus = [int]$plusField.Value
						$result.plusSubscriber = $result.plusStatus -gt 0
					}
				}
			}
		}
	}

	return $result
}

function Get-PythonCommand {
	foreach ($name in @('python', 'py')) {
		$command = Get-Command $name -ErrorAction SilentlyContinue
		if ($command) { return $command.Source }
	}
	return $null
}

function Read-ReplayPlusProgress([string]$DotaPath, [int64]$AccountId, [string]$ServerUrl) {
	if (-not $DotaPath -or -not $AccountId) { return $null }
	$scriptPath = Join-Path $PSScriptRoot 'read-replay-plus.py'
	if (-not (Test-Path $scriptPath)) {
		$scriptPath = Join-Path $env:TEMP 'aegis-read-replay-plus.py'
		try {
			Invoke-WebRequest -Uri "$($ServerUrl.TrimEnd('/'))/read-replay-plus.py" -OutFile $scriptPath -UseBasicParsing
		} catch {
			return $null
		}
	}
	$python = Get-PythonCommand
	if (-not $python) { return $null }
	Write-Host 'Читаем локальные реплеи .dem — это может занять около минуты.' -ForegroundColor Cyan
	$json = & $python $scriptPath --dota $DotaPath --account-id $AccountId
	if (-not $json) { return $null }
	return $json | ConvertFrom-Json
}

$steamPath = Find-SteamPath
$dotaPath = Find-DotaPath $steamPath
$cacheFile = Find-DotaSocCache $dotaPath
$cache = Read-DotaSocCache $(if ($cacheFile) { $cacheFile.FullName } else { $null })
$replay = Read-ReplayPlusProgress $dotaPath ([int64]($cache.cacheAccountId)) $ServerUrl
$heroes = @()
if ($replay -and $replay.heroes) {
	$heroes = @(
		$replay.heroes | ForEach-Object {
			@{ heroId = [int]$_.heroId; level = [int]$_.level; xp = [int]$_.xp }
		}
	)
}
$preview = [ordered]@{
	helperVersion = '0.4.1'
	detectedAt = [DateTime]::UtcNow.ToString('o')
	steamDetected = [bool]$steamPath
	dotaDetected = [bool]$dotaPath
	steamPath = $steamPath
	dotaPath = $dotaPath
	cacheFound = $cache.cacheFound
	cacheFileName = $cache.cacheFileName
	cacheAccountId = $cache.cacheAccountId
	plusStatus = $cache.plusStatus
	plusSubscriber = $cache.plusSubscriber
	challengeCount = $cache.challengeCount
	replaysScanned = $(if ($replay) { $replay.replaysScanned } else { 0 })
	matchesWithMetadata = $(if ($replay) { $replay.matchesWithMetadata } else { 0 })
	heroProgressPresent = $heroes.Count -gt 0
	officialHeroCount = $heroes.Count
}

Write-Host 'Dota Sync Helper' -ForegroundColor Cyan
Write-Host 'Не читает пароль Steam, Steam Guard, cookies, refresh tokens и inventory из кэша.' -ForegroundColor Yellow
Write-Host 'Читает cache_*.soc и локальные реплеи .dem. Инвентарь и userdata не отправляются.' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Будет отправлено на Aegis Arena:' -ForegroundColor Cyan
$preview | Format-List | Out-Host
if ($heroes.Count -gt 0) {
	Write-Host "Из реплеев прочитано официальных уровней: $($heroes.Count)." -ForegroundColor Green
} elseif ($cache.cacheFound) {
	Write-Host 'Кэш Plus найден, но в сохранённых .dem нет вашего hero_xp. На /heroes останется оценка OpenDota.' -ForegroundColor DarkYellow
}

if ($InspectOnly) {
	Write-Host 'Режим проверки: снимок не отправлен.' -ForegroundColor Green
	exit 0
}

if ([string]::IsNullOrWhiteSpace($Code)) {
	$Code = Read-Host 'Вставьте одноразовый код из профиля Aegis Arena'
}
if ([string]::IsNullOrWhiteSpace($Code)) { throw 'Код синхронизации не указан.' }

if (-not $Confirm) {
	$confirmation = Read-Host 'Отправить этот технический snapshot? (yes/no)'
	if ($confirmation -ne 'yes') {
		Write-Host 'Синхронизация отменена.'
		exit 0
	}
}

$body = @{
	code = $Code.Trim()
	steamPath = $steamPath
	dotaPath = $dotaPath
	payload = @{
		helperVersion = $preview.helperVersion
		detectedAt = $preview.detectedAt
		steamDetected = $preview.steamDetected
		dotaDetected = $preview.dotaDetected
		cacheFound = $cache.cacheFound
		cacheFileName = $cache.cacheFileName
		cacheAccountId = $cache.cacheAccountId
		plusStatus = $cache.plusStatus
		plusSubscriber = $cache.plusSubscriber
		challengeCount = $cache.challengeCount
		replaysScanned = $preview.replaysScanned
		matchesWithMetadata = $preview.matchesWithMetadata
		heroProgressPresent = $preview.heroProgressPresent
	}
	heroes = $heroes
} | ConvertTo-Json -Depth 5

try {
	$response = Invoke-RestMethod -Method Post -Uri "$($ServerUrl.TrimEnd('/'))/api/dota-sync/submit" -ContentType 'application/json; charset=utf-8' -Body $body
} catch {
	throw "Сервер отклонил снимок. Проверьте код, срок действия и адрес $ServerUrl. $_"
}

if ($response.ok) {
	Write-Host 'Snapshot отправлен. Вернитесь в профиль Aegis Arena — страница обновится сама.' -ForegroundColor Green
}
