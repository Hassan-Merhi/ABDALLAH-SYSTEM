# ABDALLAH-SYSTEM Cloud Run test container.
# Node is pinned to the repository's .node-version (24.22.1).
# Chromium is not downloaded: browser-driven carrier scraping is unavailable.
FROM node:24.22.1-bookworm-slim AS builder

WORKDIR /app
ENV CI=true \
    PUPPETEER_SKIP_DOWNLOAD=true

COPY . .
RUN npm ci --include=dev --include=optional --no-audit --no-fund
RUN npm run build
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:24.22.1-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates fontconfig fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app/ /app/
USER node
EXPOSE 8080

# Cloud Run provides PORT=8080. The ERP listens on 0.0.0.0 by default.
# Use the exact production startup preload chain from package.json.
CMD ["node", "--expose-gc", "--import", "./server/startupPreload.mjs", "--import", "./server/runtimeMemoryGuard.mjs", "dist/index.js"]
