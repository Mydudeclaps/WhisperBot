FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    WHISPERBOT_DB_PATH=/data/whisperbot.db \
    WHISPERBOT_HEALTH_PATH=/tmp/whisperbot-health.json

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .
RUN mkdir -p /data /app/logs && chown -R node:node /data /app/logs

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD ["node", "scripts/healthcheck.js"]

CMD ["node", "bot.js"]
