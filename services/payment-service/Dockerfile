FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY shared ./shared
COPY services/payment-service ./services/payment-service

RUN npm install --workspace=shared --workspace=services/payment-service
RUN npm run prisma:generate --workspace=services/payment-service

EXPOSE 3003

CMD ["npm", "run", "start", "--workspace=services/payment-service"]
