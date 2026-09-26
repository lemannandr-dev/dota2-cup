# Dependency Security Migration

## Current state

The web application uses `steam-user@5.3.0`. The Steam ticket chain has been migrated to `steam-appticket@2.0.1` through a scoped npm override.

- `protobufjs@7.6.5` through `steam-user`, `steam-session`, and `steam-appticket@2.0.1`.

The critical protobuf finding is resolved. `sharp` is upgraded to `0.35.4`. Remaining audit findings are high/moderate PostCSS issues in the current Next.js dependency line.

## Do not use

Do not run `npm audit fix --force` on the production branch. It proposes breaking changes to the Steam and Next.js dependency tree.

Do not force a protobuf override on `steam-appticket@1.x`. The valid migration is the scoped `steam-appticket@2.0.1` override recorded in `package.json`.

## Migration sequence

1. Create a branch named `security/next-postcss` for the remaining audit findings.
2. Check the Next.js 15 patch line and PostCSS compatibility before considering Next 16.
3. Read the upstream changelogs for PostCSS and Next.js.
4. Add a focused smoke test for every code path importing `steam-user` or `steam-appticket`.
5. Upgrade one package at a time and run:

   ```powershell
   npm ci
   npm ls steam-user steam-appticket protobufjs adm-zip
   npm run check
   npm run build
   npm run test:e2e -- --project=desktop
   docker build -t aegis-arena-security .
   ```

6. Verify that `npm ls steam-user steam-appticket protobufjs adm-zip` is valid and reports `steam-appticket@2.0.1` with protobuf 7.6.5.
7. Verify Steam OpenID separately from GC ingestion, including bearer authentication, protobuf parsing, retry behavior, and shutdown.
8. Run `npm audit --omit=dev --audit-level=moderate` and attach the report to the change.
9. Merge only when `npm ls` is valid and no critical issue is reachable from the production web process.

## Preferred architecture

Keep Steam OpenID in the web application and isolate `steam-user`, `steam-appticket`, and GC protobuf code in the authenticated `gc-worker`. The web process should communicate with that worker only through the existing bearer-protected internal endpoint.

This limits the vulnerable dependency surface and makes future Steam package upgrades independent from the public web runtime.
