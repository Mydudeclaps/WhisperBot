# WhisperBot Deployment

WhisperBot runs as one dedicated Docker service. Keep it at one replica because
its economy is backed by SQLite.

## Required Discord configuration

Create a host-only environment file at `/etc/whisperbot/whisperbot.env` from
`.env.example` and supply:

- `DISCORD_TOKEN` — bot token
- `CLIENT_ID` — Discord application ID
- `GUILD_ID` — server used for guild-scoped command registration

Never commit that file. The application must have the Guild Members and Message
Content privileged intents enabled because existing features consume both.

## Build and validate

```bash
npm ci
npm test
npm run check
docker compose build
```

## Register commands and start

```bash
docker compose run --rm whisperbot npm run deploy:commands
docker compose up -d
docker compose ps
docker compose logs --tail 100 whisperbot
```

The service stores SQLite data in the `whisperbot-data` named volume and logs in
`whisperbot-logs`. Its Docker health check fails if Discord never reaches the
ready event or if the runtime heartbeat becomes stale.

## Backups

Run `npm run backup` inside the service. It uses SQLite's online backup API and
writes a timestamped copy beneath `/data/backups`, which is inside the persistent
data volume. Retention and off-host copying should be handled by the host backup
policy.
