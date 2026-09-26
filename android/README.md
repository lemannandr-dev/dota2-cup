# Aegis Arena for Android

Нативный Android Studio-проект открывает текущую Next.js/PWA в защищённом `WebView`. Игроки и организаторы используют один backend, одну Steam-сессию и тот же функционал, что в мобильном браузере.

## Что поддерживается

- Steam OpenID внутри доверенного домена `steamcommunity.com` с возвратом в Aegis Arena.
- Cookie-сессия, JavaScript, DOM storage и стандартная навигация назад.
- Выбор файлов и съёмка фото системной камерой для доказательств спора.
- Android App Links для production HTTPS-домена и схема `aegisarena://open/...`.
- Внешние ссылки открываются системным приложением; Aegis Arena и Steam остаются внутри приложения.
- Экран потери соединения, индикатор загрузки, Safe Browsing и системные отступы Android 15/16.
- Фирменный системный splash, экран загрузки с логотипом Aegis и adaptive launcher icon.
- Нижняя навигация для гостя, игрока и организатора с крупными зонами касания.
- Обложка с героями Dota 2, анимированная сцена и редактируемые через `/admin/appearance` изображения веб-интерфейса.

## Открытие в Android Studio

1. Поднимите web-стенд: `docker compose -f docker-compose.second.yml up -d`.
2. В Android Studio выберите **Open** и каталог `D:\DOTA\android`.
3. Выберите JDK 17 и дождитесь Gradle Sync.
4. Запустите конфигурацию `app` на эмуляторе или устройстве.

Debug-сборка открывает `http://10.0.2.2:3002/home`. Это специальный адрес хоста для Android Emulator. На физическом телефоне debug URL нужно заменить на доступный телефону IP компьютера или использовать HTTPS-стенд.

## Командная сборка

```powershell
cd D:\DOTA\android
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat assembleDebug lintDebug
```

Готовый APK: `app\build\outputs\apk\debug\app-debug.apk`.

Обновление дизайна и его проверка описаны в [mobile-visual-upgrade.md](../docs/mobile-visual-upgrade.md). Обложка и фон меняются в админке без пересборки APK; нативная иконка запуска входит в сборку.

Исправления входа, приглашения в пати, актуальный APK и результаты тестирования: [mobile-auth-party-fix.md](../docs/mobile-auth-party-fix.md). В этой версии добавлены восстановление входа после сетевого сбоя, живой состав пати, приглашения участников по URL и ограничения состава после check-in.

## Release

Release должен использовать публичный HTTPS-домен. Перед сборкой задайте параметры:

```powershell
.\gradlew.bat assembleRelease `
  -PAEGIS_BASE_URL=https://arena.example.com/home `
  -PAEGIS_APP_HOST=arena.example.com
```

Подпишите AAB/APK через **Build > Generate Signed Bundle / APK**. SHA-256 сертификата добавьте в `ANDROID_APP_SHA256` web-сервера:

```powershell
npm run android:sha256 -- path\to\upload-keystore.jks your-alias
```

Несколько отпечатков разделяются запятыми. Next.js отдаёт их по `https://<домен>/.well-known/assetlinks.json`.

Для production также должны указывать на публичные HTTPS/WSS-адреса: `NEXTAUTH_URL`, `APP_URL`, `NEXT_PUBLIC_SOCKET_URL`. Файл `assetlinks.json` должен открываться без редиректа.

## Выполненная проверка

- Android Gradle Plugin 8.13.0, Gradle 8.14.3, JDK 17, compile/target SDK 36, min SDK 26.
- `assembleDebug` и `lintDebug` проходят.
- APK установлен на AVD API 36 (`emulator-5554`), cold start успешен.
- Проверены `/home`, `/tournaments`, фильтры bottom sheet, `/teams`, состав 5/5, live-сетка по раундам и загрузка страницы Steam OpenID.
- Проверены касания нижней навигации, выход из пустого фильтра, меню действий команды и системная кнопка «Назад».
- Проверены системные отступы, deep links и отсутствие crash/SSL/network ошибок приложения в `logcat`.

Полный callback Steam требует входа реальной учётной записью и намеренно не автоматизирован. Камеру нужно дополнительно проверить на физическом устройстве: AVD подтверждает интеграцию выбора файла, но не качество реальной камеры.
