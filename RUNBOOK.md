# RUNBOOK — турниры и деньги

Короткий чеклист для орга и админа перед живым призом.

## Realtime (Socket.IO)

Канонический стенд: сервис `realtime2` в `docker-compose.second.yml` → порт **3003**.

- Web: `NEXT_PUBLIC_SOCKET_URL=http://localhost:3003` (в Docker-сети для эмулятора Android часто `http://10.0.2.2:3003`).
- Production: `APP_URL=https://…`, `NEXT_PUBLIC_SOCKET_URL=wss://…`.
- Realtime: `REALTIME_PORT=3003`, `REDIS_URL=redis://redis2:6379`.
- Клиент джойнит только комнаты `tournament:{id}` (home подписывается по ID карточек).
- Health: `GET http://localhost:3003/health`.
- Не запускайте второй `npm run realtime` на хосте, пока крутится Docker `realtime2`.

Проверка: после репорта счёта карточка на `/home` обновляется без ожидания 8с (сокет → `/api/home/live`). При падении realtime home падает на poll **60с**.

---

## Перед первым живым призом

1. **Бэкап Postgres обязателен** — см. `PLAN.md`, этап E. На стенде: `docker-compose.second.yml`, сервис `postgres2`.
2. Проверить баланс орга и TOTP: `/admin` → кошелёк, эскроу на карточке кубка.
3. Запустить сверку: `npm run reconcile` — дельта должна быть 0.

## Отмена кубка

1. Орг: «Отменить турнир» на карточке (LIVE/CHECK_IN) — вызывает `releasePrizeEscrow`.
2. Авто-отмена tick (нет чек-ина): worker тоже возвращает эскроу перед `CANCELLED`.
3. Проверить инбокс: не должно остаться «эскроу не вернулся» (`CONFIRMED` + `CANCELLED`).

## Возврат эскроу вручную

Если инбокс показывает зависший эскроу:

1. Убедиться, что призы **не** выплачены (`PAID` блокирует возврат).
2. На карточке кубка — отмена или повторный вызов release через publish/tick.
3. Проверить проводку `prize_escrow_release:{tournamentId}` в `/admin/balance`.

## pg_dump / restore (docker-compose.second.yml → postgres2)

Контейнер на втором стенде: `media-game-cup-postgres-3`, БД `mediagame`.

```bash
# dump
docker exec media-game-cup-postgres-3 pg_dump -U postgres -d mediagame > backup-mediagame.sql

# restore (осторожно — перезапишет данные)
Get-Content backup-mediagame.sql | docker exec -i media-game-cup-postgres-3 psql -U postgres -d mediagame
# или в bash:
# cat backup-mediagame.sql | docker exec -i media-game-cup-postgres-3 psql -U postgres -d mediagame
```

Быстрый снимок: `npm run db:backup` (пишет в `backups/`).

Имена контейнеров уточните через `docker ps` на вашем стенде.

## Tick завис или дублирует работу

1. Должен работать **один** `npm run tick` (или один контейнер worker).
2. Блокировки: Redis `lock:tournament-tick` (быстрый фильтр) + Postgres `pg_advisory_lock(8347291)`.
3. Если tick не бежит: `DISABLE_TOURNAMENT_TICK=1` на web — это норма; worker отдельно.
4. Логи worker: `auto-bracket failed`, `escrow release on tick cancel failed`, `tournament-tick failed`.

## Сверка балансов

```bash
npm run reconcile
```

Расхождение **не чинится автоматически** — только алерт в `/admin` и вывод скрипта. Разбирать вручную по `Transaction` и `User.balance`.

## Двойная выплата / двойной репорт

- Выплата: idempotency key `prize_pay:{tournamentId}:{place}` в metadata проводки; второй POST — no-op.
- Эскроу: `prize_escrow:{tournamentId}`.
- Репорт: `@@unique([matchId, teamId])` + `FOR UPDATE` на матч в одной транзакции с решением.
