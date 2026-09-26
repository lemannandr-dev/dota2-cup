# Dota Game Coordinator Worker

`gc-worker` is isolated from the public application network. It has no host port and only calls the internal endpoint `POST /api/internal/dota-guilds/snapshot` on `web2`.

## Required setup

1. Create a separate Steam account for the worker. Do not use a personal or tournament organizer account.
2. Put a long random value in `DOTA_GC_INTERNAL_TOKEN` in `.env`.
3. Set `DOTA_GC_BOT_ACCOUNT_NAME`. For a first login, set `DOTA_GC_BOT_PASSWORD` and the current `DOTA_GC_BOT_TWO_FACTOR_CODE`. `steam-user` requests a refresh token from Steam and saves it at `/data/refresh-token` in the private `gc-worker-data` Docker volume. The token is never written to logs.
4. After the log says that the refresh token was stored, remove `DOTA_GC_BOT_PASSWORD` and `DOTA_GC_BOT_TWO_FACTOR_CODE` from `.env`. The worker automatically reads the private saved token after restart. Alternatively, set `DOTA_GC_BOT_REFRESH_TOKEN` yourself as an injected secret.
5. Start the second stack with `docker compose -f docker-compose.second.yml up -d --build`.
6. Inspect `docker compose -f docker-compose.second.yml logs -f gc-worker` and call `http://localhost:3002` only through the web app. The worker health endpoint is internal-only.

## Data contract

The worker may publish only a GC response that it received and decoded. A guild snapshot must set `source: "gc"` and `payload.gcMessage` (the decoded protobuf name). It also includes the GC guild ID, name, optional tag/avatar, points, leaderboard rank, level, members and the rest of the decoded payload. The Next.js endpoint rejects anything without that GC marker. The profile block is shown only after such a snapshot is stored.

The worker establishes a dedicated Steam/Dota session through `steam-user`. The next implementation step is a protocol adapter for a verified guild protobuf request/response pair. Until that adapter is confirmed against a GC response, the worker must not synthesize guild details or call the snapshot endpoint.