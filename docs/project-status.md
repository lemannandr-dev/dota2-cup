# Project Status

## Verified on 2026-09-08

The web release gate passes locally:

```powershell
npm run check
npm run build
npm run test:e2e
```

Current verified results:

- TypeScript: passing.
- Prisma generate/schema validation: passing.
- Unit tests: 69 files, 246 tests passing.
- Production Next.js build: passing.
- Desktop E2E: passing.
- Full configured Playwright run: 18 passing, 12 explicitly skipped because they require the database-backed party fixture.
- Docker production runner image: builds successfully.
- Environment validation: passing for test/development and rejects production defaults.

## Remaining work

### Lint warnings

There are 12 warnings in the current synchronized working tree. They are concentrated in `Header.tsx`, `TeamCatalog.tsx`, and `TournamentExplorer.tsx`. These files are being rewritten by an external formatter/synchronizer between editor reads and edits, so their exact contents can change during a patch. Do not disable lint globally. Apply the final `next/image`, `next/link`, and hook dependency changes once those files are stable, then remove any temporary scoped exceptions.

### Dependency security

`sharp` is upgraded to `0.35.4`, and the Steam ticket chain is migrated to `steam-appticket@2.0.1` with protobuf 7.6.5. The critical protobuf issue is resolved. Remaining production audit findings are high/moderate PostCSS issues in the Next.js dependency line:

```text
next -> postcss
```

Do not use `npm audit fix --force`. Follow [dependency-security-migration.md](dependency-security-migration.md) for the remaining Next/PostCSS migration and keep Steam/GC smoke tests in the release gate.

### Android

Local Android Gradle execution is blocked on machines without Android SDK configuration. CI is prepared in [.github/workflows/android.yml](../.github/workflows/android.yml) and installs JDK 17, SDK 36, runs tests, builds the debug APK, and uploads it as an artifact. Local validation still requires `ANDROID_HOME` or `android/local.properties`.

### Secrets

Rotate any real Steam API key and internal secrets before production. Never commit `.env` or paste secret values into logs/chat.
