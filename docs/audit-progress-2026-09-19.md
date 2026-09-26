# Аудит и прогресс — 2026-09-19

Стенд: `docker compose -f docker-compose.second.yml` → `http://localhost:3002`  
Порты изолированы от других проектов на хосте: web `3002`, realtime `3003`, Postgres `5434`, Redis `6381`, MinIO `9102/9103`.

## Что поднято

- Исправлен образ MinIO: Docker Hub `minio/minio` отдавал `pull access denied`; в `docker-compose.second.yml` стоит `quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z`.
- Стек `web2` / `realtime2` / `tick2` / `postgres2` / `redis2` / `minio2` / `gc-worker` запущен.
- `GET http://localhost:3002` → `200`.
- `gc-worker` перезапускается без Steam refresh-токена — ожидаемо, гильдию не выдумывает.

## Сделано в этом прогоне

### Безопасность и сервер

1. **Same-origin на мутациях матча** — `report` / `result` / `lobby` требуют `Origin === APP_URL` (`server/http/mutation-guards.ts`).
2. **Rate limit** — сдача счёта / судейский результат / лобби ограничены через Redis (`assertRateLimit`).
3. **Идемпотентный повтор счёта** — повтор после обрыва сети с тем же счётом:
   - не падает на «матч уже завершён», если репорт совпал;
   - не открывает второй `Dispute` при `NEEDS_REVIEW`;
   - клиент шлёт `Idempotency-Key`, ответ кэшируется в Redis на 24ч.
4. **UI счёта** — один авто-retry сети + понятная ошибка без дубля спора (`MatchScoreForm`).

### UX PC + mobile

1. **Один сценарий «Игроки и пати»** — `/players` редиректит на `/party-search?tab=players`.
2. Header / Footer / guest tab bar ведут в `/party-search`, без двух конкурирующих пунктов.
3. **Timeline дня матча** — вертикальная шкала «Заявка → Отметка → Готовность → Лобби → Счёт» (`MatchDayTimeline` + `MatchDayNextStep`).

### Тесты

- `tests/report-replay.test.ts` — чистые правила replay + валидация `Idempotency-Key`.

## Что ещё в очереди (не делали в этом прогоне)

| Приоритет | Тема | Почему ждёт |
|---|---|---|
| P0 | Production секреты / бэкап Postgres | Нужны реальные ключи и ops, не код |
| P0 | GC protobuf гильдии | Нет проверенного адаптера; выдумывать нельзя |
| P1 | Web Push + VAPID | Нужна Prisma-модель и ключи |
| P1 | Единый inbox орга (споры + просрочки) | Крупный UI-срез |
| P1 | Мастер создания турнира с черновиком | Многошаговая форма |
| P1 | Idempotency на остальных money/ready API | Паттерн готов — раскатать |
| P2 | i18n EN | Аудитория не подтверждена |
| P2 | Release signing Android / Safari iOS | Нужны устройства и домен |
| P2 | Video / Highlight / Achievement | Заморожено до живого приза |

## Порты vs другие проекты

На хосте уже крутится `gucomm-*` на `80/443/3001/5432/...`. Aegis Arena намеренно на **других** портах (`3002+`), конфликтов нет.

## Сделано 2026-09-19 (четвёртый прогон)

1. **Фильтры заявок** на карточке кубка: поиск + чипы (на разборе / поправить / лист / приняты / ждут / готовы / вне).
2. **Массовые напоминания** орга → колокольчик: чек-ин / готовность / «поправьте» / старт (`POST .../applications/remind`).
3. **Web Push каркас**: модель `PushSubscription`, API `/api/push/subscribe`, opt-in UI, SW `push`/`notificationclick`. Нужны VAPID в `.env`.
4. Origin + rate limit на review / promote / remind.
