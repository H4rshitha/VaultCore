FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY shared ./shared
COPY services/auth-service ./services/auth-service

RUN npm install --workspace=shared --workspace=services/auth-service
RUN npm run prisma:generate --workspace=services/auth-service

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace=services/auth-service"]
