FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY shared ./shared
COPY services/ledger-service ./services/ledger-service

RUN npm install --workspace=shared --workspace=services/ledger-service
RUN npm run prisma:generate --workspace=services/ledger-service

EXPOSE 3004

CMD ["npm", "run", "start", "--workspace=services/ledger-service"]
