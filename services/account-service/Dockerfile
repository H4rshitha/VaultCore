FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY shared ./shared
COPY services/account-service ./services/account-service

RUN npm install --workspace=shared --workspace=services/account-service
RUN npm run prisma:generate --workspace=services/account-service

EXPOSE 3002

CMD ["npm", "run", "start", "--workspace=services/account-service"]
