FROM node:22-alpine AS base

WORKDIR /app

# Copy root manifest & lockfile first (cache-friendly layer)
COPY package.json package-lock.json ./

# Copy workspace packages needed by this service
COPY prisma ./prisma
COPY shared ./shared
COPY services/account-service ./services/account-service

# Install all workspaces this service needs (ci = lockfile-exact)
RUN npm ci --workspace=shared --workspace=services/account-service --ignore-scripts

# Generate Prisma Client (needs schema.prisma in /app/prisma/)
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate --schema=prisma/schema.prisma

# ──────────────────────────────────────────────────────────────────────────
FROM base AS production

ENV NODE_ENV=production

EXPOSE 3002

CMD ["node", "services/account-service/src/server.js"]
