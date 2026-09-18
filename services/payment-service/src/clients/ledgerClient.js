import { config } from '../config/index.js';
import {
  createLogger,
  InternalServerError,
  ledgerCircuitBreaker,
  CircuitBreakerOpenError,
} from '@vaultcore/shared';

const logger = createLogger('payment-ledger-client');

export class LedgerClient {
  /**
   * Post double-entry transfer records to the internal Ledger Service with timeout, retry, and traceId propagation, protected by Circuit Breaker
   */
  static async recordDoubleEntry({
    idempotencyKey,
    referenceId,
    sourceAccountNumber,
    targetAccountNumber,
    amount,
    currency = 'USD',
    description,
    traceId,
  }) {
    return await ledgerCircuitBreaker.execute(
      async () => {
        const url = `${config.ledgerServiceUrl}/entries`;
        const maxRetries = 2;
        const timeoutMs = 5000;

        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          try {
            if (attempt > 0) {
              logger.info(`Retrying Ledger Service call (attempt ${attempt}/${maxRetries})...`, {
                traceId,
                referenceId,
              });
              // Exponential backoff
              await new Promise((resolve) => setTimeout(resolve, attempt * 200));
            }

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-service-api-key': config.internalApiKey,
                ...(traceId ? { 'X-Trace-ID': traceId } : {}),
              },
              body: JSON.stringify({
                idempotencyKey,
                referenceId,
                sourceAccountNumber,
                targetAccountNumber,
                amount,
                currency,
                description,
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
              // Client errors (4xx) are non-transient, do not retry
              if (response.status >= 400 && response.status < 500) {
                logger.warn('Ledger service returned client error (non-transient)', {
                  status: response.status,
                  error: data.error,
                  traceId,
                });
                const err = new Error(data.error?.message || 'Ledger validation error');
                err.statusCode = response.status;
                err.details = data.error?.details;
                throw err;
              }

              // Server errors (5xx) are transient, retry if attempts remain
              logger.warn(`Ledger service returned server error ${response.status}`, {
                status: response.status,
                traceId,
              });
              lastError = new Error(
                data.error?.message || `Ledger service responded with status ${response.status}`
              );
              continue;
            }

            logger.info('Double-entry ledger records successfully created in Ledger Service', {
              referenceId,
              idempotencyKey,
              traceId,
            });

            return data.data;
          } catch (error) {
            clearTimeout(timeoutId);

            if (error.statusCode) {
              // Non-transient client error thrown intentionally above
              throw error;
            }

            // Network error / Timeout
            const isAbort = error.name === 'AbortError';
            const errorMsg = isAbort
              ? `Ledger request timed out after ${timeoutMs}ms`
              : error.message;

            logger.warn(`Ledger communication error on attempt ${attempt + 1}: ${errorMsg}`, {
              traceId,
              isTimeout: isAbort,
            });

            lastError = new Error(errorMsg);
          }
        }

        logger.error('All retry attempts to Ledger Service failed', {
          message: lastError?.message,
          traceId,
        });

        throw new InternalServerError(
          `Ledger service communication failure: ${lastError?.message || 'Unknown error'}`
        );
      },
      { traceId }
    );
  }

  /**
   * Post single-account cash deposit to Ledger Service
   */
  static async recordDeposit({
    idempotencyKey,
    referenceId,
    accountNumber,
    amount,
    currency = 'USD',
    description,
    traceId,
  }) {
    return await ledgerCircuitBreaker.execute(
      async () => {
        const url = `${config.ledgerServiceUrl}/entries/deposit`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-api-key': config.internalApiKey,
            ...(traceId ? { 'X-Trace-ID': traceId } : {}),
          },
          body: JSON.stringify({
            idempotencyKey,
            referenceId,
            accountNumber,
            amount,
            currency,
            description,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          const err = new Error(data.error?.message || 'Ledger deposit failed');
          err.statusCode = response.status;
          throw err;
        }
        return data.data;
      },
      { traceId }
    );
  }

  /**
   * Post single-account cash withdrawal to Ledger Service
   */
  static async recordWithdrawal({
    idempotencyKey,
    referenceId,
    accountNumber,
    amount,
    currency = 'USD',
    description,
    traceId,
  }) {
    return await ledgerCircuitBreaker.execute(
      async () => {
        const url = `${config.ledgerServiceUrl}/entries/withdraw`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-api-key': config.internalApiKey,
            ...(traceId ? { 'X-Trace-ID': traceId } : {}),
          },
          body: JSON.stringify({
            idempotencyKey,
            referenceId,
            accountNumber,
            amount,
            currency,
            description,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          const err = new Error(data.error?.message || 'Ledger withdrawal failed');
          err.statusCode = response.status;
          throw err;
        }
        return data.data;
      },
      { traceId }
    );
  }
}
