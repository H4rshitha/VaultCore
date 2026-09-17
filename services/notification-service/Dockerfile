FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY shared ./shared
COPY services/notification-service ./services/notification-service

RUN npm install --workspace=shared --workspace=services/notification-service

EXPOSE 3005

CMD ["npm", "run", "start", "--workspace=services/notification-service"]
