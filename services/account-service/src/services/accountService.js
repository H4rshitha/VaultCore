import { AccountRepository } from '../repositories/accountRepository.js';
import { generateAccountNumber } from '../utils/accountNumberGenerator.js';
import {
  NotFoundError,
  ForbiddenError,
  createLogger,
  accountCache,
  CACHE_TTL,
} from '@vaultcore/shared';

const logger = createLogger('account-service-logic');
const accountRepository = new AccountRepository();

export class AccountService {
  /**
   * Create account with 12-digit account number generation & collision retry loop
   */
  async createAccount(userId, { type = 'CHECKING', currency = 'USD', initialDeposit = 0 }, traceId) {
    const user = await accountRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError(`Customer with ID ${userId} not found`);
    }

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;
      const accountNumber = generateAccountNumber();

      try {
        const account = await accountRepository.createAccount({
          accountNumber,
          userId,
          type,
          currency,
          balance: initialDeposit,
        });

        logger.info('Bank account created successfully', {
          accountNumber,
          userId,
          type,
          currency,
          status: 'ACTIVE',
          traceId,
        });

        return account;
      } catch (error) {
        if (error.code === 'P2002' && attempts < maxAttempts) {
          logger.warn(`Account number collision detected on ${accountNumber}, retrying attempt ${attempts}...`, { traceId });
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Fetch account details with Cache-Aside pattern (TTL: 5 minutes) and ownership authorization check.
   * If customer attempts to access another user's account, throws 403 Forbidden.
   */
  async getAccountDetails(accountNumber, requestingUserId, requestingUserRole, traceId) {
    // 1. Check Redis DB1 cache
    const cachedAccount = await accountCache.getDetails(accountNumber, traceId);
    if (cachedAccount) {
      // Validate ownership on cache hit
      if (requestingUserRole !== 'ADMIN' && requestingUserRole !== 'TELLER') {
        if (cachedAccount.userId !== requestingUserId) {
          logger.warn(`Unauthorized account access attempt on cached account: User ${requestingUserId} requested ${accountNumber}`, { traceId });
          throw new ForbiddenError('Access denied: You do not own this bank account');
        }
      }
      return cachedAccount;
    }

    // 2. Cache miss -> fetch from PostgreSQL
    const existingAccount = await accountRepository.findByAccountNumber(accountNumber);
    if (!existingAccount) {
      throw new NotFoundError(`Account number ${accountNumber} not found`);
    }

    // 3. Admins and Tellers can view any account
    if (requestingUserRole === 'ADMIN' || requestingUserRole === 'TELLER') {
      await accountCache.setDetails(accountNumber, existingAccount, traceId, CACHE_TTL.ACCOUNT_DETAILS);
      return existingAccount;
    }

    // 4. For CUSTOMER role, verify ownership
    if (existingAccount.userId !== requestingUserId) {
      logger.warn(`Unauthorized account access attempt: User ${requestingUserId} requested ${accountNumber}`, { traceId });
      throw new ForbiddenError('Access denied: You do not own this bank account');
    }

    // 5. Store in Redis DB1 cache with 5m TTL
    await accountCache.setDetails(accountNumber, existingAccount, traceId, CACHE_TTL.ACCOUNT_DETAILS);

    return existingAccount;
  }

  /**
   * Fetch account balance with Cache-Aside pattern (TTL: 30 seconds)
   */
  async getAccountBalance(accountNumber, requestingUserId, requestingUserRole, traceId) {
    // 1. Check Redis DB1 cache
    const cachedBalance = await accountCache.getBalance(accountNumber, traceId);
    if (cachedBalance) {
      if (requestingUserRole !== 'ADMIN' && requestingUserRole !== 'TELLER') {
        if (cachedBalance.userId !== requestingUserId) {
          logger.warn(`Unauthorized balance access attempt on cached balance: User ${requestingUserId} requested ${accountNumber}`, { traceId });
          throw new ForbiddenError('Access denied: You do not own this bank account');
        }
      }
      return {
        accountNumber: cachedBalance.accountNumber,
        balance: cachedBalance.balance,
        currency: cachedBalance.currency,
        status: cachedBalance.status,
      };
    }

    // 2. Cache miss -> fetch details (which handles ownership validation)
    const account = await this.getAccountDetails(accountNumber, requestingUserId, requestingUserRole, traceId);

    const balancePayload = {
      accountNumber: account.accountNumber,
      userId: account.userId,
      balance: account.balance,
      currency: account.currency,
      status: account.status,
    };

    // 3. Store in Redis DB1 with 30s TTL
    await accountCache.setBalance(accountNumber, balancePayload, traceId, CACHE_TTL.ACCOUNT_BALANCE);

    return {
      accountNumber: balancePayload.accountNumber,
      balance: balancePayload.balance,
      currency: balancePayload.currency,
      status: balancePayload.status,
    };
  }

  async getUserAccounts(userId, page = 1, limit = 10, traceId) {
    const skip = (page - 1) * limit;
    logger.info('Fetching user accounts', { userId, page, limit, traceId });

    const { accounts, total } = await accountRepository.findByUserId(userId, skip, limit);

    return {
      accounts,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
