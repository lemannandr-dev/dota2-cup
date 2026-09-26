# Dota Sync Helper for Windows

Companion находит Steam, читает `game\dota\cache_<SteamID>_1.soc` и локальные реплеи `game\dota\replays\*.dem`. Пароль Steam, cookies, inventory и сырой userdata не отправляются.

## Как синхронизировать

1. В профиле нажмите «Получить одноразовый код».
2. Скачайте `DotaSyncHelper.ps1`. Рядом должен быть `read-replay-plus.py` (helper скачает его сам, если есть Python).
3. Нужен Python 3. Затем:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\DotaSyncHelper.ps1 -ServerUrl http://localhost:3002
```

Проверка без отправки:

```powershell
.\DotaSyncHelper.ps1 -InspectOnly
```

## Что читается

- SO-кэш: подписка Dota Plus и челленджи.
- Реплеи `.dem` (не `.edem`): сообщение `DOTA_UM_MatchMetadata` / `CDOTAMatchMetadata.hero_xp`. Это тот же Plus XP, что парсер OpenDota берёт из реплея. Учитываются только матчи, где есть ваш SteamID.

Герои без сохранённого реплея остаются оценкой OpenDota.
