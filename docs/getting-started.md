# VaultCore Getting Started Guide

This guide will help you set up and run the VaultCore distributed banking platform locally.

## Prerequisites

- **Node.js**: `v20+`
- **Docker & Docker Compose**
- **Git**

## Quick Start with Docker Compose

1. **Clone & Setup Environment Variables**:

   ```bash
   cp .env.example .env
   ```

2. **Start Infrastructure & Microservices**:

   ```bash
   docker compose up --build
   ```

3. **Verify Health Endpoints**:
   - **API Gateway**: `http://localhost:3000/health`
   - **Swagger API Docs**: `http://localhost:3000/docs`
   - **RabbitMQ Management**: `http://localhost:15672` (User: `guest`, Pass: `guest`)
   - **Grafana Dashboards**: `http://localhost:3001` (User: `admin`, Pass: `admin`)
   - **Prometheus UI**: `http://localhost:9090`

## Local Development (Without Docker for Microservices)

1. **Start Infrastructure Containers (Postgres, Redis, RabbitMQ)**:

   ```bash
   docker compose up postgres redis rabbitmq -d
   ```

2. **Install Workspace Dependencies**:

   ```bash
   npm install
   ```

3. **Generate Prisma Client Schemas**:

   ```bash
   npm run prisma:generate
   ```

4. **Run Microservices in Development Mode**:
   - Gateway: `npm run dev --workspace=services/gateway`
   - Auth Service: `npm run dev --workspace=services/auth-service`
   - Account Service: `npm run dev --workspace=services/account-service`
   - Payment Service: `npm run dev --workspace=services/payment-service`
   - Ledger Service: `npm run dev --workspace=services/ledger-service`
   - Notification Service: `npm run dev --workspace=services/notification-service`

## Running Load Tests

Run k6 performance tests against the API Gateway:

```bash
k6 run load-tests/k6/payment-flow.js
```
