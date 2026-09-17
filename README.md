# VaultCore - Distributed Banking Platform

[![Node.js](https://img.shields.io/badge/Node.js-v20-green.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://www.postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-indigo)](https://www.prisma.io)
[![Redis](https://img.shields.io/badge/Redis-7-red)](https://redis.io)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3-orange)](https://www.rabbitmq.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue)](https://www.docker.com)

**VaultCore** is an enterprise-grade distributed banking microservices platform engineered for high concurrency, double-entry financial ledger accuracy, idempotent payment transfers, and event-driven asynchronous messaging.

---

## Microservice Architecture Overview

VaultCore is organized into dedicated microservices, each built with **Production-Ready Clean Architecture**:

- `gateway` (Port `3000`): Central API proxy with rate limiting, unified routing, and OpenAPI Swagger aggregation.
- `auth-service` (Port `3001`): User registration, identity management, and JWT token authentication.
- `account-service` (Port `3002`): Bank account lifecycle, savings/checking accounts, and real-time balance tracking.
- `payment-service` (Port `3003`): Transfer processing, idempotency protection, and event publishing.
- `ledger-service` (Port `3004`): Immutable double-entry bookkeeping journal entries.
- `notification-service` (Port `3005`): Asynchronous RabbitMQ subscriber for dispatching customer notifications.

### Supporting Directories
- `shared/`: Common middleware, HTTP error handling, Winston logging, Redis, and RabbitMQ wrappers.
- `infrastructure/`: Production Dockerfiles and Kubernetes manifests (Deployments, StatefulSets, ConfigMaps, Ingress).
- `monitoring/`: Prometheus scrape configuration and Grafana dashboard provisioning.
- `load-tests/`: k6 performance load testing scenarios.
- `docs/`: System architecture, API specifications, and setup guides.

---

## Quick Start

### Run Complete Platform via Docker Compose

```bash
# 1. Clone & Copy environment variables
cp .env.example .env

# 2. Build and launch all services and infrastructure
docker compose up --build
```

### Access Ports & Interfaces

- **API Gateway**: `http://localhost:3000`
- **Swagger Documentation**: `http://localhost:3000/docs`
- **RabbitMQ Management Dashboard**: `http://localhost:15672` (Credentials: `guest` / `guest`)
- **Grafana Monitoring Dashboard**: `http://localhost:3001` (Credentials: `admin` / `admin`)
- **Prometheus Metrics**: `http://localhost:9090`

---

## Tech Stack

- **Runtime & Framework**: Node.js (ES Modules `"type": "module"`) + Express.js
- **Database & ORM**: PostgreSQL + Prisma ORM
- **Cache**: Redis (`ioredis`)
- **Event Message Broker**: RabbitMQ (`amqplib`)
- **Containerization & Orchestration**: Docker Compose, Kubernetes manifests
- **Observability**: Prometheus & Grafana
- **Load Testing**: k6
- **Validation & Security**: Joi, Helmet, CORS, JWT, bcryptjs

---

## Documentation

For complete detailed guides:
- [Architecture Overview](docs/architecture.md)
- [API Specifications](docs/api-spec.md)
- [Getting Started & Local Development](docs/getting-started.md)
