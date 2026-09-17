FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY shared ./shared
COPY services/gateway ./services/gateway

RUN npm install --workspace=shared --workspace=services/gateway

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=services/gateway"]
