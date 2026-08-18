#!/usr/bin/env bash
set -euo pipefail

npm ci
npm test
npm run check
npm audit --omit=dev --audit-level=moderate
docker build -t whisperbot:candidate .
docker run --rm --entrypoint npm whisperbot:candidate test
docker run --rm --entrypoint npm whisperbot:candidate run check
