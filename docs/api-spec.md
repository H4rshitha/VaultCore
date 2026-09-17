# VaultCore API Specification Summary

All microservice endpoints are exposed through the **API Gateway** on port `3000` under `/api/v1/`.

## Endpoints Summary

### 1. API Gateway (`:3000`)

- `GET /health` - Overall system health check.
- `GET /docs` - Interactive Swagger UI documentation.

### 2. Auth Service (`/api/v1/auth`)

- `POST /api/v1/auth/register` - Create user credentials (`email`, `password`, `firstName`, `lastName`, `role`).
- `POST /api/v1/auth/login` - Authenticate user and receive JWT access token.
- `GET /api/v1/auth/me` - Get current authenticated user profile (`Bearer JWT required`).

### 3. Account Service (`/api/v1/accounts`)

- `POST /api/v1/accounts` - Open a new bank account (`type`: `SAVINGS`|`CHECKING`, `currency`, `initialDeposit`).
- `GET /api/v1/accounts` - Retrieve all accounts owned by authenticated user.
- `GET /api/v1/accounts/:accountNumber` - Retrieve specific account details & balance.

### 4. Payment Service (`/api/v1/payments`)

- `POST /api/v1/payments/transfer` - Initiate funds transfer with idempotency (`idempotencyKey`, `sourceAccountNumber`, `targetAccountNumber`, `amount`, `currency`).
- `GET /api/v1/payments/:id` - Fetch payment processing status.

### 5. Ledger Service (`/api/v1/ledger`)

- `POST /api/v1/ledger/journals` - Record a balanced double-entry financial journal.
- `GET /api/v1/ledger/accounts/:accountNumber` - Audit trail of all DEBIT/CREDIT ledger entries for an account.

### 6. Notification Service (`/api/v1/notifications`)

- `GET /api/v1/notifications/logs` - Retrieve dispatched notification logs.
