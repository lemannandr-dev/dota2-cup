# Aegis Arena: mobile-first roadmap

Статус обновлён: 2026-09-07. Целевой формат — одна responsive PWA для iOS, Android и desktop на текущем Next.js App Router плюс тонкий Android-контейнер без отдельной бизнес-логики.

## Принципы

- Каждый рабочий экран отвечает на пять вопросов: статус, следующее действие, дедлайн, ответственный, история.
- Игрок за два нажатия доходит от `/home` до обязательного действия.
- Организатор сначала видит очередь проблем, затем аналитику.
- Секреты лобби, доказательства и финансовые API не кэшируются service worker.
- Свайп и анимация ускоряют работу, но никогда не являются единственным способом выполнить действие.

## Этап 0 — стабильная основа

- [x] Steam OpenID сохраняет внешний origin и порт `3002`.
- [x] TypeScript и полный набор unit-тестов проходят.
- [x] Production build проходит.
- [x] Добавлен `.dockerignore`, контекст сборки уменьшен примерно с 900 МБ до 10 МБ.
- [x] Добавить Playwright и матрицу мобильных viewport.
- [x] Проверить Chrome/WebView Android на AVD API 36.
- [ ] Проверить реальный Safari iOS и физический Android-телефон.

## Этап 1 — mobile shell и дизайн-система

- [x] Пять постоянных вкладок игрока с иконками и safe area.
- [x] Отдельная нижняя навигация организатора.
- [x] Добавлен компактный раздел `/admin/more`.
- [x] Минимальная высота ключевых сенсорных контролов 44–48 px.
- [x] Поля матча используют размер текста 16 px на мобильном.
- [x] Добавлена анимация подтверждения кнопки и `prefers-reduced-motion`.
- [x] Рабочие карточки переведены на радиус 8 px.
- [x] Добавить общий `BottomSheet`, `StickyActionBar`, toast и подтверждение опасных действий.
- [x] Убрать дублирующие desktop-контролы со всех экранов меньше 768 px.

## Этап 2 — PWA

- [x] Manifest, theme color, standalone mode и viewport safe area.
- [x] Оригинальные иконки 180/192/512 px и maskable-вариант.
- [x] Service worker с network-first навигацией и безопасным offline fallback.
- [x] Service worker не кэширует API и персональные страницы.
- [x] Добавить контролируемый сценарий установки для Android и инструкцию iOS.
- [x] Добавить Prisma-модель push-подписок, VAPID и Web Push.
- [x] Добавить badge непрочитанных уведомлений.

## Этап 3 — путь игрока

- [x] Перестроить `/home` вокруг одного следующего действия.
- [x] Добавить вкладки и мобильные фильтры каталога турниров.
- [x] Сделать мобильную сетку: выбор раунда и вертикальный список матчей.
- [x] Перестроить команду вокруг состава 5/5, приглашений и запасных.
- [x] Объединить поиск пати и игроков в один мобильный сценарий.
- [x] Привести профиль, героев и баланс к общей мобильной структуре.

## Этап 4 — день матча

- [x] Счёт вводится крупными степперами, без маленьких number-input.
- [x] Лобби и его действия имеют удобные touch targets.
- [x] Копирование лобби показывает устойчивое состояние с иконкой.
- [x] Сделать отдельный мобильный порядок блоков пары.
- [x] Добавить закреплённое следующее действие над tab bar.
- [x] Добавить загрузку доказательства с камеры и предпросмотр.
- [x] Добавить временную шкалу готовности, лобби, репортов и решения судьи.
- [x] Защитить повторную отправку idempotency key и восстановлением после потери сети.

## Этап 5 — рабочее место организатора

- [x] Поставить очередь дел выше карточек статистики.
- [x] Заменить таблицы шириной 980 px на мобильные строки с detail sheet.
- [x] Добавить фильтры заявок и массовые напоминания.
- [x] Объединить судейство, споры и просроченные матчи в один inbox.
- [x] Сделать мобильный предпросмотр эскроу и выплат.

## Этап 6 — качество релиза

- [x] E2E: Steam callback (unit), команда/заявка/check-in/ready/лобби/счёт/спор/выплата (Playwright opt-in).
- [x] Viewport: 320–1024 + матрица проектов Playwright; без горизонтальной прокрутки на основных экранах.
- [x] Нет горизонтальной прокрутки на основных экранах (`viewport-overflow.spec.ts`).
- [x] Accessibility mobile = 100 на `/home`, `/tournaments`, `/party-search`, `/teams`, `/heroes` (Lighthouse).
- [x] Performance mobile ≥90 на каталогах в production (`/home` 90, `/tournaments` 93, `/party-search` 92, `/teams` 92, `/heroes` 91 на `next start`; docker `web2` = `next dev` и занижает LCP).
- [x] Проверить увеличенный текст и offline-shell (`a11y-resilience.spec.ts` + `/offline.html`).
- [x] Закрытая проверка (авто): 5 игроков + 2 орга — `npm run test:e2e:closed` (`closed-cohort.spec.ts`). Физические устройства остаются в этапе 0/7.

## Этап 7 — Android Studio

- [x] Создать Android Studio-проект с JDK 17, SDK 36 и Gradle wrapper.
- [x] Добавить WebView-сессию, Steam OpenID, системную камеру/файлы и offline-экран.
- [x] Добавить Android deep links и endpoint Digital Asset Links.
- [x] Собрать debug APK и прогнать Android Lint.
- [x] Установить APK на AVD API 36 и проверить основные мобильные экраны.
- [ ] Настроить production HTTPS-домен, release signing и заполнить `ANDROID_APP_SHA256`.
- [ ] Проверить камеру, загрузку файла, Steam callback и push на физическом Android-устройстве.
- [ ] Собрать подписанный AAB и провести закрытый тест Google Play.

## Следующий срез

1. Физические устройства: Safari iOS PWA + Android (камера, Steam callback, push) — чеклист в [release-checklist.md](release-checklist.md).
2. Production HTTPS-домен, `ANDROID_APP_SHA256` (`npm run android:sha256`), release AAB / Play closed test.
3. Env: `APP_URL=https://…`, `NEXT_PUBLIC_SOCKET_URL=wss://…` (см. `.env.example` и RUNBOOK realtime2).

### UX mech slice (код)

- [x] Realtime home (`useHomeLive` / `useSocketRooms`) вместо 8s poll scores.
- [x] List SSR: только stored OpenDota ranks (`storedRankOf`).
- [x] Sticky next-action на всех фазах кубка + cup staff desk.
- [x] Pull-to-refresh, BottomSheet swipe, haptics, offline mutation queue.
- [x] Local hero verts + medals in ready + abilities only on match recap.
- [x] Release docs / env checklist HTTPS/AAB.
- [x] Playwright prep: sheet close, offline queue flush, match-day home score (opt-in).
