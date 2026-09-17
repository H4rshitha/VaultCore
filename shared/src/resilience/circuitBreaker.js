import { CIRCUIT_STATES, CIRCUIT_BREAKER_CONFIG } from '../constants/index.js';
import { createLogger } from '../logger/index.js';

const defaultLogger = createLogger('circuit-breaker');

/**
 * Custom error thrown when a request is blocked by an OPEN circuit breaker
 */
export class CircuitBreakerOpenError extends Error {
  constructor(serviceName, retryAfterSec = 30, lastError = null) {
    super(`Circuit breaker for [${serviceName}] is OPEN. Request failed fast.`);
    this.name = 'CircuitBreakerOpenError';
    this.statusCode = 503;
    this.serviceName = serviceName;
    this.circuitState = CIRCUIT_STATES.OPEN;
    this.retryAfterSec = retryAfterSec;
    this.lastError = lastError;
  }
}

/**
 * Enterprise-grade Circuit Breaker implementation with CLOSED, OPEN, and HALF_OPEN states
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default-service';
    this.failureThreshold =
      options.failureThreshold || CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD || 5;
    this.successThreshold =
      options.successThreshold || CIRCUIT_BREAKER_CONFIG.SUCCESS_THRESHOLD || 3;
    this.openTimeoutMs = options.openTimeoutMs || CIRCUIT_BREAKER_CONFIG.OPEN_TIMEOUT_MS || 30000;
    this.logger = options.logger || defaultLogger;
    this.isFailure =
      options.isFailure ||
      ((err) => {
        if (
          err.statusCode &&
          err.statusCode >= 400 &&
          err.statusCode < 500 &&
          err.statusCode !== 408 &&
          err.statusCode !== 429
        ) {
          return false;
        }
        return true;
      });

    this.state = CIRCUIT_STATES.CLOSED;
    this.consecutiveFailures = 0;
    this.halfOpenSuccessCount = 0;
    this.openedAt = null;
    this.lastFailureTime = null;
    this.lastFailureReason = null;
    this.lastSuccessTime = null;

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      failFastCount: 0,
      recoveryCount: 0,
      stateTransitions: 0,
    };

    this.transitionHistory = [];
  }

  /**
   * Transition circuit to a new state and record history
   */
  _transitionTo(newState, reason = '') {
    if (this.state === newState) return;

    const fromState = this.state;
    this.state = newState;
    this.stats.stateTransitions++;

    const transitionRecord = {
      from: fromState,
      to: newState,
      timestamp: new Date().toISOString(),
      reason,
    };

    this.transitionHistory.push(transitionRecord);
    if (this.transitionHistory.length > 50) {
      this.transitionHistory.shift();
    }

    if (newState === CIRCUIT_STATES.OPEN) {
      this.openedAt = Date.now();
      this.halfOpenSuccessCount = 0;
    } else if (newState === CIRCUIT_STATES.HALF_OPEN) {
      this.halfOpenSuccessCount = 0;
    } else if (newState === CIRCUIT_STATES.CLOSED) {
      this.consecutiveFailures = 0;
      this.halfOpenSuccessCount = 0;
      this.openedAt = null;
    }

    this.logger.info(
      `Circuit breaker [${this.name}] transitioned from ${fromState} to ${newState}`,
      {
        serviceName: this.name,
        circuitState: newState,
        previousState: fromState,
        transitionReason: reason,
      }
    );
  }

  /**
   * Execute an action with circuit breaker protection
   *
   * @param {Function} actionFn - Async function to execute
   * @param {Object} [context] - Context containing traceId, fallback function, etc.
   * @returns {Promise<any>}
   */
  async execute(actionFn, context = {}) {
    const traceId = context.traceId || 'trace-unknown';
    const fallback = context.fallback;
    this.stats.totalRequests++;

    // 1. Check if OPEN state should transition to HALF_OPEN
    if (this.state === CIRCUIT_STATES.OPEN) {
      const timeSinceOpen = Date.now() - (this.openedAt || 0);
      if (timeSinceOpen >= this.openTimeoutMs) {
        this._transitionTo(
          CIRCUIT_STATES.HALF_OPEN,
          `Open timeout of ${this.openTimeoutMs}ms expired`
        );
      } else {
        // Fast fail immediately
        this.stats.failFastCount++;
        const retryAfterSec = Math.max(1, Math.ceil((this.openTimeoutMs - timeSinceOpen) / 1000));

        this.logger.warn(`Circuit breaker [${this.name}] is OPEN. Fast-failing request.`, {
          traceId,
          serviceName: this.name,
          circuitState: CIRCUIT_STATES.OPEN,
          failureReason: this.lastFailureReason || 'Circuit is OPEN',
          retryAfterSec,
          failFastCount: this.stats.failFastCount,
        });

        if (typeof fallback === 'function') {
          return await fallback(
            new CircuitBreakerOpenError(this.name, retryAfterSec, this.lastFailureReason)
          );
        }

        throw new CircuitBreakerOpenError(this.name, retryAfterSec, this.lastFailureReason);
      }
    }

    // 2. Execute protected action
    try {
      const result = await actionFn();

      // On Success
      this.stats.successfulRequests++;
      this.lastSuccessTime = new Date().toISOString();

      if (this.state === CIRCUIT_STATES.HALF_OPEN) {
        this.halfOpenSuccessCount++;
        this.logger.info(
          `Circuit breaker [${this.name}] probe request successful (${this.halfOpenSuccessCount}/${this.successThreshold})`,
          {
            traceId,
            serviceName: this.name,
            circuitState: this.state,
            halfOpenSuccessCount: this.halfOpenSuccessCount,
          }
        );

        if (this.halfOpenSuccessCount >= this.successThreshold) {
          this.stats.recoveryCount++;
          this._transitionTo(
            CIRCUIT_STATES.CLOSED,
            `Success threshold of ${this.successThreshold} consecutive successes achieved in HALF_OPEN`
          );
        }
      } else if (this.state === CIRCUIT_STATES.CLOSED) {
        this.consecutiveFailures = 0;
      }

      return result;
    } catch (error) {
      // If error is not considered a service failure (e.g., 4xx user validation), rethrow directly
      if (!this.isFailure(error)) {
        throw error;
      }

      // On Failure
      this.stats.failedRequests++;
      this.lastFailureTime = new Date().toISOString();
      this.lastFailureReason = error.message;

      if (this.state === CIRCUIT_STATES.HALF_OPEN) {
        // Any failure in HALF_OPEN immediately trips circuit back to OPEN
        this._transitionTo(CIRCUIT_STATES.OPEN, `Failure during HALF_OPEN trial: ${error.message}`);
        this.logger.error(
          `Circuit breaker [${this.name}] failed probe in HALF_OPEN, reopened circuit`,
          {
            traceId,
            serviceName: this.name,
            circuitState: CIRCUIT_STATES.OPEN,
            failureReason: error.message,
          }
        );
      } else if (this.state === CIRCUIT_STATES.CLOSED) {
        this.consecutiveFailures++;
        this.logger.warn(
          `Circuit breaker [${this.name}] recorded failure (${this.consecutiveFailures}/${this.failureThreshold})`,
          {
            traceId,
            serviceName: this.name,
            circuitState: this.state,
            consecutiveFailures: this.consecutiveFailures,
            failureReason: error.message,
          }
        );

        if (this.consecutiveFailures >= this.failureThreshold) {
          this._transitionTo(
            CIRCUIT_STATES.OPEN,
            `Failure threshold of ${this.failureThreshold} reached in CLOSED state`
          );
        }
      }

      if (typeof fallback === 'function') {
        return await fallback(error);
      }

      throw error;
    }
  }

  /**
   * Get detailed circuit breaker status
   */
  getStatus() {
    const timeSinceOpen = this.openedAt ? Date.now() - this.openedAt : 0;
    const secondsUntilHalfOpen =
      this.state === CIRCUIT_STATES.OPEN
        ? Math.max(0, Math.ceil((this.openTimeoutMs - timeSinceOpen) / 1000))
        : 0;

    return {
      serviceName: this.name,
      state: this.state,
      failureThreshold: this.failureThreshold,
      successThreshold: this.successThreshold,
      openTimeoutMs: this.openTimeoutMs,
      consecutiveFailures: this.consecutiveFailures,
      halfOpenSuccessCount: this.halfOpenSuccessCount,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
      secondsUntilHalfOpen,
      lastFailureReason: this.lastFailureReason,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stats: { ...this.stats },
      recentTransitions: this.transitionHistory.slice(-5),
    };
  }

  /**
   * Manually reset circuit breaker to CLOSED
   */
  reset() {
    this._transitionTo(CIRCUIT_STATES.CLOSED, 'Manual reset');
    this.consecutiveFailures = 0;
    this.halfOpenSuccessCount = 0;
    this.openedAt = null;
    this.lastFailureReason = null;
  }

  /**
   * Manually force a specific circuit state (useful for testing or administrative interventions)
   */
  forceState(state, reason = 'Administrative override') {
    if (Object.values(CIRCUIT_STATES).includes(state)) {
      this._transitionTo(state, reason);
    }
  }
}

/**
 * Registry managing all named circuit breaker instances in the application
 */
export class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Register or get an existing circuit breaker instance
   */
  getOrCreate(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ name, ...options }));
    }
    return this.breakers.get(name);
  }

  get(name) {
    return this.breakers.get(name);
  }

  getAll() {
    return Array.from(this.breakers.values());
  }

  getAllStatus() {
    const result = {};
    for (const [name, breaker] of this.breakers.entries()) {
      result[name] = breaker.getStatus();
    }
    return result;
  }

  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// Initialize default protected circuit breakers
export const ledgerCircuitBreaker = circuitBreakerRegistry.getOrCreate(
  CIRCUIT_BREAKER_CONFIG.SERVICES.LEDGER,
  {
    failureThreshold: CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD,
    successThreshold: CIRCUIT_BREAKER_CONFIG.SUCCESS_THRESHOLD,
    openTimeoutMs: CIRCUIT_BREAKER_CONFIG.OPEN_TIMEOUT_MS,
  }
);

export const rabbitmqCircuitBreaker = circuitBreakerRegistry.getOrCreate(
  CIRCUIT_BREAKER_CONFIG.SERVICES.RABBITMQ,
  {
    failureThreshold: CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD,
    successThreshold: CIRCUIT_BREAKER_CONFIG.SUCCESS_THRESHOLD,
    openTimeoutMs: CIRCUIT_BREAKER_CONFIG.OPEN_TIMEOUT_MS,
  }
);

export const notificationCircuitBreaker = circuitBreakerRegistry.getOrCreate(
  CIRCUIT_BREAKER_CONFIG.SERVICES.NOTIFICATION,
  {
    failureThreshold: CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD,
    successThreshold: CIRCUIT_BREAKER_CONFIG.SUCCESS_THRESHOLD,
    openTimeoutMs: CIRCUIT_BREAKER_CONFIG.OPEN_TIMEOUT_MS,
  }
);
