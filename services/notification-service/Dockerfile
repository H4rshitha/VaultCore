FROM node:22-alpine AS base

WORKDIR /app

# Copy root manifest & lockfile first (cache-friendly layer)
COPY package.json package-lock.json ./

# Copy workspace packages needed by this service
COPY shared ./shared
COPY services/notification-service ./services/notification-service

# Install only the workspaces this service needs (ci = lockfile-exact)
RUN npm ci --workspace=shared --workspace=services/notification-service --ignore-scripts

# ──────────────────────────────────────────────────────────────────────────
FROM base AS production

ENV NODE_ENV=production

EXPOSE 3005

CMD ["node", "services/notification-service/src/server.js"]
