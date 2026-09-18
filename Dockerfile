FROM node:22-alpine

WORKDIR /app

# Install Redis server and bash
RUN apk add --no-cache redis bash

# Copy package manifests for all workspaces
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY shared ./shared
COPY services ./services
COPY start-production.js ./start-production.js

# Install dependencies across workspaces
RUN npm ci --ignore-scripts

# Generate Prisma Client
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate --schema=prisma/schema.prisma

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "start-production.js"]
