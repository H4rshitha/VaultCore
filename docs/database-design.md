# VaultCore Production Database Specification

This document presents the refined relational database architecture for the VaultCore banking platform implemented using PostgreSQL 16 and Prisma ORM.

## Entity Relationship (ER) Diagram

```mermaid
erDiagram
    users ||--o{ accounts : "owns (1:N)"
    users ||--o{ audit_logs : "triggers (1:N)"
    accounts ||--o{ transactions : "sourceOf (1:N)"
    accounts ||--o{ transactions : "targetOf (1:N)"
    accounts ||--o{ ledger_entries : "records (1:N)"
    transactions ||--o{ ledger_entries : "comprises (1:N)"
    transactions ||--o{ outbox_events : "publishes (1:N)"

    users {
        string id PK "UUID"
        string email UK "Unique Email Address"
        string passwordHash "Bcrypt Hash"
        string firstName "First Name"
        string lastName "Last Name"
        UserRole role "CUSTOMER | TELLER | ADMIN"
        boolean isActive "Default: true"
        datetime deletedAt "Soft Delete Timestamp"
        datetime createdAt "Creation Timestamp"
        datetime updatedAt "Update Timestamp"
    }

    accounts {
        string id PK "UUID"
        string accountNumber UK "12-Digit Unique Account Number"
        string userId FK "Foreign Key to users.id"
        AccountType type "SAVINGS | CHECKING | INVESTMENT"
        AccountStatus status "ACTIVE | FROZEN | CLOSED"
        decimal balance "18,2 Precision Decimal"
        string currency "ISO 4217 Currency (USD)"
        int version "Optimistic Locking Counter"
        datetime deletedAt "Soft Delete Timestamp"
        datetime createdAt "Creation Timestamp"
        datetime updatedAt "Update Timestamp"
    }

    transactions {
        string id PK "UUID"
        string idempotencyKey UK "UUID Idempotency Key"
        string referenceId UK "External/Audit Reference ID"
        string sourceAccountId FK "Nullable FK to accounts.id"
        string targetAccountId FK "Nullable FK to accounts.id"
        decimal amount "18,2 Precision Decimal"
        string currency "ISO 4217 Currency"
        TransactionCategory type "DEPOSIT | WITHDRAWAL | TRANSFER"
        TransactionStatus status "PENDING | PROCESSING | COMPLETED | FAILED | REVERSED"
        string description "Optional Memo"
        string failureReason "Error details if status=FAILED"
        datetime createdAt "Creation Timestamp"
        datetime updatedAt "Update Timestamp"
    }

    ledger_entries {
        string id PK "UUID"
        string transactionId FK "Foreign Key to transactions.id"
        string accountId FK "Foreign Key to accounts.id"
        TransactionType type "DEBIT | CREDIT"
        decimal amount "18,2 Precision Decimal"
        decimal balanceAfter "18,2 Precision Decimal balance snapshot"
        datetime createdAt "Immutable Timestamp"
    }

    outbox_events {
        string id PK "UUID"
        string aggregateType "Domain Aggregate (e.g. TRANSACTION)"
        string aggregateId "Aggregate Identifier"
        string eventType "Event Name (e.g. PAYMENT_COMPLETED)"
        json payload "Structured JSON Event Body"
        OutboxStatus status "PENDING | PUBLISHED | FAILED"
        int retryCount "Retry Attempt Count"
        string error "Processing Error Message"
        datetime processedAt "Timestamp when published"
        datetime createdAt "Creation Timestamp"
        datetime updatedAt "Update Timestamp"
        string transactionId FK "Nullable FK to transactions.id"
    }

    audit_logs {
        string id PK "UUID"
        string userId FK "Nullable FK to users.id"
        string action "Action Name (e.g. USER_LOGIN)"
        string entity "Entity Target"
        string entityId "Entity Primary Key"
        json metadata "Contextual Metadata JSON"
        string ipAddress "Request IP Address"
        string userAgent "Client User-Agent String"
        datetime createdAt "Log Timestamp"
    }
```

---

## Key Refinements Summary

1. **High Precision Monetary Values (`Decimal(18, 2)`)**:
   - `accounts.balance`, `transactions.amount`, `ledger_entries.amount`, and `ledger_entries.balanceAfter` all use `@db.Decimal(18, 2)` to prevent overflow or truncation during large volume banking transactions.

2. **Unique Index Constraints**:
   - `accounts.accountNumber` features a `@unique` index and explicit `@@index([accountNumber])`.
   - `transactions.referenceId` features a `@unique` constraint and explicit `@@index([referenceId])`.

3. **Explicit `TransactionType` Enum for Ledger**:
   - `LedgerEntry.type` uses the `TransactionType` enum (`DEBIT` or `CREDIT`).
   - `Transaction.type` uses `TransactionCategory` (`DEPOSIT`, `WITHDRAWAL`, `TRANSFER`).

4. **Clean Transfer Metadata Isolation**:
   - `transactions` records money movement intent, routing, and status without mutating or storing account balance snapshots.

5. **Immutability & Locking Boundaries**:
   - `ledger_entries` remains strictly immutable (no `updatedAt` / `deletedAt`).
   - `accounts` maintains exclusive optimistic concurrency control via integer `version`.
