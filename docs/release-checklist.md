# Aegis Arena Release Checklist

## Required local gates

Run from the repository root:

```powershell
npm ci
npm run env:check
npm run check
npm run build
npm run test:e2e
npm run test:e2e:party
npm run audit:production
```

The release is blocked when:

- TypeScript fails;
- Prisma generation or migrations fail;
- unit tests fail;
- production build fails;
- E2E smoke tests fail;
- a critical audit issue is present;
- production env uses a default secret.

Lint warnings in the formatter-sensitive UI files must be reviewed before release even when they do not fail the command. The current warning owners are `Header.tsx`, `TeamCatalog.tsx`, and `TournamentExplorer.tsx`.

## Docker verification

```powershell
docker compose -f docker-compose.prod.yml config -q
docker build -t aegis-arena-release .
```

Verify that the production image starts with `npm run env:check` before Prisma migrations and that no source bind mount is used.

## Android verification

CI runs the authoritative Android check through [.github/workflows/android.yml](../.github/workflows/android.yml). For a local check, configure Android SDK/JDK 17 first:

```powershell
cd android
.\gradlew.bat test
.\gradlew.bat lintDebug
.\gradlew.bat assembleDebug
```

Before a release build, verify the public HTTPS base URL, Android App Links, Steam return URL, file picker, camera evidence flow, back navigation, and offline screen.

Print the release keystore fingerprint for `ANDROID_APP_SHA256`:

```powershell
npm run android:sha256 -- path\to\upload-keystore.jks your-alias
```

Set the printed value on the web host, then confirm `https://<domain>/.well-known/assetlinks.json` returns it without redirect.

## Security and secrets

- Rotate Steam API and internal service tokens before production.
- Never commit `.env`, refresh tokens, signing keys, or production credentials.
- Run the security workflow and review the npm audit artifact.
- Keep the Steam dependency migration on `steam-appticket@2.0.1` and confirm `npm ls` is valid.
- Do not run `npm audit fix --force` on the production branch.

## Device / HTTPS / AAB (manual after code)

Checklist for physical devices before production cutover:

- [ ] Safari iOS: Add to Home Screen PWA, check-in / ready / lobby / report, push opt-in.
- [ ] Android physical: camera evidence for dispute, file picker, Steam OpenID return to `APP_URL`.
- [ ] Push: FCM/web push delivery on both platforms after Steam login.
- [ ] Production env: `APP_URL=https://…`, `NEXT_PUBLIC_SOCKET_URL=wss://…`, `ANDROID_APP_SHA256` from `npm run android:sha256`.
- [ ] Confirm `https://<domain>/.well-known/assetlinks.json` without redirect.
- [ ] Signed AAB + Play Console closed track (manual; not automated in this slice).

Realtime: only one `realtime2` / `npm run realtime` process; home joins `tournament:{id}` rooms (see RUNBOOK).

## Smoke scenarios

- Guest opens the landing page and sees the Steam entry point.
- Steam cancellation preserves the return URL.
- Authenticated user can open teams, party search, and tournaments.
- Captain can invite a player and the recipient can accept or decline.
- Concurrent roster acceptance respects the five-player limit.
- Tournament registration, check-in, bracket lock, result reporting, and dispute authorization are server-authoritative.
- Admin routes reject visitors and non-admin users.
