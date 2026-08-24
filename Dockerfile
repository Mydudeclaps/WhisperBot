FROM node:24-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && npm ci --omit=dev \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/*

FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    WHISPERBOT_DB_PATH=/data/whisperbot.db \
    WHISPERBOT_HEALTH_PATH=/tmp/whisperbot-health.json

WORKDIR /app

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .
RUN mkdir -p /data /app/logs && chown -R node:node /data /app/logs

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD ["node", "scripts/healthcheck.js"]

CMD ["node", "bot.js"]
