# VaultCore CI/CD Pipeline & Production Engineering Guide

This document provides a comprehensive specification of the automated Continuous Integration and Continuous Deployment (CI/CD) lifecycle for the **VaultCore** core banking platform.

---

## Table of Contents

1. [CI Architecture](#1-ci-architecture)
2. [Docker Build Pipeline](#2-docker-build-pipeline)
3. [Prisma Migration Flow](#3-prisma-migration-flow)
4. [Kubernetes Deployment Flow](#4-kubernetes-deployment-flow)
5. [Smoke Test Flow](#5-smoke-test-flow)
6. [Automatic Rollback Flow](#6-automatic-rollback-flow)
7. [GitHub Environments & Protection Rules](#7-github-environments--protection-rules)
8. [Required GitHub Secrets](#8-required-github-secrets)
9. [Image Tagging Strategy](#9-image-tagging-strategy)
10. [Local Development Pipeline](#10-local-development-pipeline)
11. [Production Deployment Checklist](#11-production-deployment-checklist)
12. [Troubleshooting Guide](#12-troubleshooting-guide)
13. [Manual & On-Demand Rollback Procedure](#13-manual--on-demand-rollback-procedure)
14. [Artifact Retention Policy](#14-artifact-retention-policy)

---

## 1. CI Architecture

VaultCore uses GitHub Actions with Node.js 22, npm workspace caching, and strict quality gates. Outdated in-flight workflow runs for pull requests are automatically cancelled to conserve runner resources.

```mermaid
flowchart TD
    A[Git Push / PR] --> B[Concurrency Gate: ci-ref]
    B --> C[Job 1: Code Quality, Schema & Security Audit]
    C -->|Prisma Validate + ESLint + Prettier + npm audit| D[Job 2: Backend Unit Tests Matrix]
    C -->|npm build| E[Job 3: Frontend Tests & Build]
    D -->|6 Microservices Unit Tests| F[Job 4: Platform Integration Tests]
    E --> F
    F -->|PostgreSQL + Redis + RabbitMQ| G[Job 5: Step Summary & Quality Gate]
    G --> H[Upload Artifacts: backend-coverage, frontend-coverage, integration-results]
```

### Key Workflow Triggers & Execution Steps

- **Workflow File**: `.github/workflows/ci.yml`
- **Triggers**: Pull requests and pushes across all branches (`branches: ['**']`, ignoring tags).
- **Concurrency**: `group: ci-${{ github.ref }}`, `cancel-in-progress: true`.
- **Prisma Engine Caching**: `~/.cache/prisma` cached via `actions/cache@v4` with hash key `prisma-${{ runner.os }}-${{ hashFiles('**/schema.prisma') }}`.

---

## 2. Docker Build Pipeline

Images for all six microservices are built independently in a parallelized matrix job using Docker BuildKit and GitHub Actions layer caching.

```mermaid
flowchart LR
    A[Push to main / workflow_dispatch] --> B[BuildKit Initialization]
    B --> C[GHCR Authentication via GITHUB_TOKEN]
    C --> D[Matrix Build]
    D --> D1[gateway]
    D --> D2[auth-service]
    D --> D3[account-service]
    D --> D4[payment-service]
    D --> D5[ledger-service]
    D --> D6[notification-service]
    D1 & D2 & D3 & D4 & D5 & D6 --> E[GHA Layer Cache type=gha,mode=max]
    E --> F[Push to ghcr.io]
    F --> G[Upload Build Metadata Artifacts]
    G --> H[Downstream Verification Job]
```

### Features

- **Engine**: Docker BuildKit enabled via `docker/setup-buildx-action@v3` and `DOCKER_BUILDKIT: 1`.
- **Multi-Stage Caching**: `cache-from: type=gha` and `cache-to: type=gha,mode=max`.
- **Registry Target**: `ghcr.io/${{ github.repository_owner }}/vaultcore-<service>`.

---

## 3. Prisma Migration Flow

Database migrations execute prior to application container deployment to ensure schema compatibility.

```mermaid
sequenceDiagram
    participant CI as CI/CD Runner
    participant DB as PostgreSQL Cluster
    participant S3 as Artifact Storage

    CI->>DB: 1. Health Probe (SELECT 1 poll up to 60s)
    DB-->>CI: 2. Connection Accepted
    CI->>CI: 3. npx prisma generate
    CI->>DB: 4. npx prisma migrate deploy (Deterministic)
    alt Environment is development or staging
        CI->>DB: 5. node prisma/seed.js
    else Environment is production
        CI->>CI: 5. Skip Seeding (Production Safe)
    end
    CI->>S3: 6. Upload migration-logs (30-day retention)
    CI->>CI: 7. Append Markdown Table to $GITHUB_STEP_SUMMARY
```

> [!CAUTION]
> `prisma migrate dev` is strictly prohibited in CI/CD. All production and staging updates use `prisma migrate deploy`.

---

## 4. Kubernetes Deployment Flow

Deployments use Kustomize to update image references dynamically without mutating base manifests.

```mermaid
flowchart TD
    A[Authenticate KUBE_CONFIG] --> B[Install kubectl & kustomize]
    B --> C[kustomize edit set image to Git SHA]
    C --> D[kubectl apply -k infrastructure/k8s]
    D --> E[StatefulSets Rollout: postgres, redis, rabbitmq]
    E --> F[Deployments Rollout: 6 Microservices]
    F --> G[Verify Pod Readiness Probes]
    G --> H[Upload k8s-rollout-logs]
```

### Rollout Targets

- **Infrastructure StatefulSets**: `statefulset/postgres`, `statefulset/redis`, `statefulset/rabbitmq`.
- **Microservice Deployments**:
  - `deployment/gateway-deployment`
  - `deployment/auth-deployment`
  - `deployment/account-deployment`
  - `deployment/payment-deployment`
  - `deployment/ledger-deployment`
  - `deployment/notification-deployment`

---

## 5. Smoke Test Flow

Post-rollout smoke tests validate the deployed Gateway URL against live microservice interactions.

```mermaid
flowchart TD
    A[Deploy Complete] --> B[Health & Observability Probes]
    B -->|GET /health, /health/live, /health/ready, /metrics, /docs| C[Auth Flow]
    C -->|POST /auth/signup & POST /auth/login| D[JWT Bearer Token Extraction]
    D --> E[Account Flow]
    E -->|GET /accounts, POST /accounts, /balance| F[Payment Flow]
    F -->|GET /payments/history, /payments/summary| G[Notification Flow]
    G -->|GET /notifications/history| H[Ledger Flow]
    H -->|GET /ledger/accounts/:accountNumber/entries| I[15/15 Smoke Checks Passed]
    I --> J[Upload smoke-test-report Artifact]
```

---

## 6. Automatic Rollback Flow

If either the Kubernetes rollout verification or the smoke test suite fails, an automatic rollback is immediately executed to restore cluster stability.

```mermaid
flowchart TD
    A[Deployment or Smoke Test Failure] -->|if: failure| B[Automatic Rollback Triggered]
    B --> C[kubectl rollout undo deployment/gateway-deployment]
    B --> D[kubectl rollout undo deployment/auth-deployment]
    B --> E[kubectl rollout undo deployment/account-deployment]
    B --> F[kubectl rollout undo deployment/payment-deployment]
    B --> G[kubectl rollout undo deployment/ledger-deployment]
    B --> H[kubectl rollout undo deployment/notification-deployment]
    C & D & E & F & G & H --> I[Wait for Rollout Status Completion --timeout=180s]
    I --> J[Verify Pod Readiness Probes]
    J --> K[Upload auto-rollback-logs Artifact]
    K --> L[Record Failure in GITHUB_STEP_SUMMARY]
    L --> M[Mark Workflow as FAILED (exit 1)]
```

---

## 7. GitHub Environments & Protection Rules

VaultCore supports three isolated deployment tiers configured in GitHub Settings $\rightarrow$ Environments:

| Environment       | Purpose                                                | Protection Rules                                                                |
| :---------------- | :----------------------------------------------------- | :------------------------------------------------------------------------------ |
| **`development`** | Ephemeral testing, local minikube / dev clusters.      | No approvals required; automated seeding enabled.                               |
| **`staging`**     | Pre-production testing, UAT, integration verification. | Automated branch trigger on `main`; seeding enabled.                            |
| **`production`**  | Live production banking system.                        | **Required Reviewers** (2 approvers), **Wait Timer** (5 min), Seeding disabled. |

---

## 8. Required GitHub Secrets

All secrets are mapped dynamically via GitHub Environments:

| Secret Name                | Scope & Purpose                                                                 |
| :------------------------- | :------------------------------------------------------------------------------ |
| `DATABASE_URL`             | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`).           |
| `JWT_SECRET`               | Secret key for signing short-lived JWT access tokens.                           |
| `REFRESH_TOKEN_SECRET`     | Secret key for signing rotating refresh tokens.                                 |
| `INTERNAL_SERVICE_API_KEY` | Symmetric key for secure inter-service mTLS/HTTP calls.                         |
| `POSTGRES_PASSWORD`        | Master password for PostgreSQL StatefulSet.                                     |
| `REDIS_PASSWORD`           | Authentication password for Redis distributed cache.                            |
| `RABBITMQ_PASSWORD`        | Authentication password for RabbitMQ event exchange.                            |
| `GHCR_TOKEN`               | Personal Access Token (or `${{ secrets.GITHUB_TOKEN }}`) with `packages:write`. |
| `KUBE_CONFIG`              | Base64-encoded or raw `kubeconfig` cluster credentials.                         |

---

## 9. Image Tagging Strategy

Using `docker/metadata-action@v5`, images are automatically tagged and published:

1. **`latest`**: Points to the most recent successful build on `refs/heads/main`.
2. **Git Commit SHA (`${{ github.sha }}`)**: Immutable, deterministic identifier tied to exact source commits.
3. **Semantic Versioning (`vX.Y.Z`)**: Generated on release tags (e.g. `v1.2.0`, `v1.2`, `v1`).

---

## 10. Local Development Pipeline

To run the complete verification suite locally before opening a pull request:

```bash
# 1. Validate Prisma schema & generate client
npm run prisma:validate
npm run prisma:generate

# 2. Check code formatting & linting
npx prettier --check "**/*.{js,jsx,json,md,yml,yaml}"
npm run lint

# 3. Run all unit and integration test suites
node scratch/test-ci-workflow.js
node scratch/test-docker-workflow.js
node scratch/test-prisma-migrations.js
node scratch/test-k8s-deployment.js
node scratch/test-smoke-rollback.js
```

---

## 11. Production Deployment Checklist

Before deploying to `production`:

- [ ] All CI pipeline jobs passed green on `main`.
- [ ] Docker images published and verified on `ghcr.io`.
- [ ] Database migrations tested on `staging` with zero schema errors.
- [ ] `KUBE_CONFIG` credentials verified and active.
- [ ] Production environment approval granted by designated team leads.
- [ ] Smoke tests verified with 15/15 successful responses.
- [ ] Prometheus metrics and Grafana dashboards confirmed healthy.

---

## 12. Troubleshooting Guide

### Common Failure Modes & Remedies

1. **PostgreSQL Migration Timeout (`504 / Connection refused`)**:
   - _Cause_: Database cold start or network policy blocking runner.
   - _Remedy_: Check StatefulSet logs with `kubectl logs statefulset/postgres` and verify `DATABASE_URL` credentials.
2. **Kustomize Image Replacement Error**:
   - _Cause_: Missing original image string match in `kustomization.yaml`.
   - _Remedy_: Ensure `infrastructure/k8s/kustomization.yaml` contains `vaultcore/<service>:latest` as source names.
3. **Smoke Test Non-2xx Failure**:
   - _Cause_: Downstream dependency unhealthy or rate limit exceeded.
   - _Remedy_: Inspect `smoke-logs/smoke-test-report.json` artifact for response body and status code.

---

## 13. Manual & On-Demand Rollback Procedure

To trigger a manual rollback at any time:

1. Navigate to **GitHub Actions** $\rightarrow$ **VaultCore Kubernetes Rollback Pipeline** (`.github/workflows/rollback.yml`).
2. Click **Run workflow**.
3. Select target environment (`production`, `staging`, or `development`).
4. Enter reason for rollback.
5. The workflow executes `kubectl rollout undo` on all 6 deployments and confirms pod readiness.

---

## 14. Artifact Retention Policy

| Artifact Category                                                                                | Workflow Source               | Retention Period |
| :----------------------------------------------------------------------------------------------- | :---------------------------- | :--------------- |
| **Unit & Integration Coverage** (`backend-coverage`, `frontend-coverage`, `integration-results`) | `ci.yml`                      | **14 Days**      |
| **Docker Build Metadata** (`build-metadata-<service>`)                                           | `docker-build.yml`            | **14 Days**      |
| **Database Migration Logs** (`migration-logs-<env>`)                                             | `deploy.yml`                  | **30 Days**      |
| **Kubernetes Rollout Logs** (`k8s-rollout-logs-<env>`)                                           | `deploy.yml`                  | **30 Days**      |
| **Smoke Test Reports** (`smoke-test-report-<env>`)                                               | `deploy.yml`                  | **30 Days**      |
| **Rollback Logs** (`auto-rollback-logs-<env>`, `rollback-logs-<env>`)                            | `deploy.yml` / `rollback.yml` | **30 Days**      |
| **Release Metadata** (`release-metadata-<tag>`)                                                  | `release.yml`                 | **90 Days**      |
