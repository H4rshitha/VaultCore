# VaultCore — Vercel Production Deployment Guide

This guide provides step-by-step instructions for deploying the **VaultCore** React/Vite single-page application (SPA) to **Vercel**, connecting seamlessly to the production API Gateway without altering the underlying microservices, Docker, Kubernetes, or CI/CD pipelines.

---

## 1. Architectural Overview

```mermaid
flowchart TD
    subgraph Clients["Clients / Web Browsers"]
        User["User Browser"]
    end

    subgraph VercelEdge["Vercel Edge Network (Frontend)"]
        VercelCDN["Vercel CDN / Global Edge"]
        VercelSPA["Vite React SPA (/index.html fallback)"]
        VercelHeaders["Security Headers (X-Frame-Options, CSP, etc.)"]
    end

    subgraph CloudBackend["VaultCore Backend (Cloud / Render / Kubernetes)"]
        APIGateway["VaultCore API Gateway (:3000)"]
        AuthSvc["Auth Service (:3001)"]
        AccountSvc["Account Service (:3002)"]
        PaymentSvc["Payment Service (:3003)"]
        LedgerSvc["Ledger Service (:3004)"]
        NotifSvc["Notification Service (:3005)"]
        DB[(PostgreSQL)]
        Redis[(Redis DB0-DB3)]
        Rabbit[(RabbitMQ)]
    end

    User -->|1. HTTPS GET /| VercelCDN
    VercelCDN -->|Static Assets + SPA Routing| VercelSPA
    User -->|2. Direct REST / SSE (X-Trace-ID, JWT)| APIGateway
    APIGateway --> AuthSvc
    APIGateway --> AccountSvc
    APIGateway --> PaymentSvc
    APIGateway --> LedgerSvc
    APIGateway --> NotifSvc
    AuthSvc & AccountSvc & PaymentSvc & LedgerSvc --> DB
    AccountSvc & PaymentSvc & LedgerSvc --> Redis
    PaymentSvc --> Rabbit
```

---

## 2. Prerequisites

1. **GitHub Account**: Connected to your [Vercel Dashboard](https://vercel.com).
2. **Repository Access**: Ensure your repository (`VaultCore`) is pushed to GitHub.
3. **Backend Gateway URL**: The live HTTPS endpoint of your deployed VaultCore API Gateway (e.g., deployed on Render, AWS, GCP, or Kubernetes).

---

## 3. Step-by-Step Vercel Deployment

### Step 3.1: Log into Vercel
1. Navigate to [https://vercel.com](https://vercel.com).
2. Click **Log In** and select **Continue with GitHub**.

### Step 3.2: Import Git Repository
1. In the Vercel Dashboard, click **"Add New..."** > **"Project"**.
2. Select your GitHub repository (`VaultCore` or `H4rshitha/VaultCore`).
3. Click **Import**.

### Step 3.3: Configure Project Settings
In the project configuration screen, set the following parameters:

| Configuration Field | Value | Notes |
| :--- | :--- | :--- |
| **Project Name** | `vaultcore-frontend` | Or any unique name you prefer |
| **Framework Preset** | `Vite` | Auto-detected from package.json |
| **Root Directory** | `frontend` | **Crucial**: Click "Edit" and select `frontend` |
| **Build Command** | `npm run build` | Default Vite build script |
| **Output Directory** | `dist` | Default Vite build output directory |
| **Install Command** | `npm install` | Default package installation |

### Step 3.4: Set Environment Variables
Expand the **Environment Variables** accordion and add the following:

| Variable Name | Example Value (Production) | Description |
| :--- | :--- | :--- |
| `VITE_GATEWAY_URL` | `https://vaultcore-gateway.onrender.com` | Root URL of production API Gateway |
| `VITE_API_BASE_URL` | `https://vaultcore-gateway.onrender.com/api/v1` | Base REST API endpoint |
| `VITE_SSE_URL` | `https://vaultcore-gateway.onrender.com/api/v1/events/stream` | Real-time SSE notification stream |
| `VITE_APP_ENV` | `production` | Deployment environment identifier |
| `VITE_APP_NAME` | `VaultCore Enterprise` | App title branding |

> **Note**: You can also add variables for **Preview** and **Development** environments in Vercel if using staging gateway endpoints.

### Step 3.5: Deploy
1. Click **Deploy**.
2. Vercel will clone the repository, install dependencies in `frontend/`, run `vite build`, and deploy the production bundle to global Edge locations.
3. Once complete, you will receive a live URL: `https://vaultcore-frontend.vercel.app` (or your custom domain).

---

## 4. SPA Routing & Security (`vercel.json`)

The repository includes `frontend/vercel.json` which guarantees proper SPA behavior and enterprise security:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ]
}
```

---

## 5. Local Development vs. Production Configuration

| Feature | Local Development | Production (Vercel) |
| :--- | :--- | :--- |
| **Gateway URL** | `http://localhost:3000` | `https://<your-backend-gateway-url>` |
| **API Base URL** | `http://localhost:3000/api/v1` | `https://<your-backend-gateway-url>/api/v1` |
| **Config Source** | `frontend/.env.development` or `frontend/.env.local` | Vercel Environment Variables (`VITE_*`) |
| **Trace ID** | Generated per request (`X-Trace-ID: req-...`) | Generated per request (`X-Trace-ID: req-...`) |
| **CORS** | Handled by API Gateway for `localhost:5173` | Handled by API Gateway for `*.vercel.app` & custom domains |

---

## 6. Continuous Deployment & Redeployment

- **Automatic Deployments**: Every `git push` to `main` or `master` automatically triggers a production deployment on Vercel.
- **Preview Deployments**: Pull requests automatically get isolated preview environments with unique URLs.
- **Manual Redeployment**: In Vercel Project Dashboard > **Deployments** > Click three dots (`...`) on latest deployment > **Redeploy**.

---

## 7. Troubleshooting & FAQ

### 1. 404 on Page Refresh (e.g., `/dashboard`, `/accounts`, `/transfers`)
- **Cause**: The web server tries to find a physical file matching `/dashboard` instead of falling back to `/index.html`.
- **Solution**: The `rewrites` configuration in `frontend/vercel.json` resolves this automatically. Verify that `Root Directory` is set to `frontend` in Vercel.

### 2. CORS Errors in Browser Console
- **Cause**: Backend API Gateway does not allow the Vercel domain origin.
- **Solution**: Ensure your API Gateway CORS configuration (`CORS_ORIGIN`) permits your Vercel URL (e.g. `https://vaultcore-frontend.vercel.app` or `*` in development).

### 3. API Requests Going to `http://localhost:3000` on Vercel
- **Cause**: Missing `VITE_GATEWAY_URL` or `VITE_API_BASE_URL` in Vercel project environment variables.
- **Solution**: Add the variables in Vercel Project Settings > **Environment Variables** and trigger a **Redeploy** (Build cache disabled).

---

## 8. Verification & Health Checks

Before promoting to production traffic, run the automated verification scripts:

```bash
# 1. Verify build integrity & no leaked localhost URLs
node scratch/test-vercel-build.js

# 2. Verify production frontend routes & configuration
node scratch/test-production-frontend.js
```
