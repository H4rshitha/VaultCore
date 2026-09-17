import { UserRepository } from '../repositories/userRepository.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/token.js';
import { TokenStore } from '../utils/tokenStore.js';
import { ConflictError, UnauthorizedError, NotFoundError, createLogger } from '@vaultcore/shared';

const logger = createLogger('auth-service-logic');
const userRepository = new UserRepository();

export class AuthService {
  async signup({ email, password, firstName, lastName, role }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('A user with this email address already exists');
    }

    const passwordHash = await hashPassword(password);
    const user = await userRepository.createUser({
      email,
      passwordHash,
      firstName,
      lastName,
      role: role || 'CUSTOMER',
    });

    const accessToken = generateAccessToken(user);
    const { token: refreshToken, jti } = generateRefreshToken(user);

    // Persist refresh token session in Redis DB3 with 7-day TTL (key: refresh:{userId}:{jti})
    await TokenStore.saveRefreshToken(user.id, jti, refreshToken);

    logger.info('User signup completed', { userId: user.id, email: user.email });

    const { passwordHash: _, ...safeUser } = user;
    return {
      user: safeUser,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is deactivated');
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = generateAccessToken(user);
    const { token: refreshToken, jti } = generateRefreshToken(user);

    // Persist refresh token session in Redis DB3 with 7-day TTL (key: refresh:{userId}:{jti})
    await TokenStore.saveRefreshToken(user.id, jti, refreshToken);

    logger.info('User login completed', { userId: user.id, email: user.email, role: user.role });

    const { passwordHash: _, ...safeUser } = user;
    return {
      user: safeUser,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async refreshToken(refreshTokenInput) {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshTokenInput);
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired Refresh Token');
    }

    const userId = decoded.userId;
    const jti = decoded.jti || decoded.tokenId;

    if (!userId || !jti) {
      throw new UnauthorizedError('Malformed Refresh Token claims');
    }

    // Verify key refresh:{userId}:{jti} exists in Redis DB3
    const isValidInRedis = await TokenStore.isRefreshTokenValid(userId, jti);
    if (!isValidInRedis) {
      throw new UnauthorizedError('Refresh Token expired or revoked');
    }

    const user = await userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User no longer active or valid');
    }

    const newAccessToken = generateAccessToken(user);
    logger.info('Token refreshed successfully', { userId, jti });

    return { accessToken: newAccessToken };
  }

  async logout(refreshTokenInput) {
    if (refreshTokenInput) {
      try {
        const decoded = verifyRefreshToken(refreshTokenInput);
        const userId = decoded.userId;
        const jti = decoded.jti || decoded.tokenId;
        if (userId && jti) {
          await TokenStore.revokeRefreshToken(userId, jti);
          logger.info('User logged out successfully, session revoked', { userId, jti });
        }
      } catch (err) {
        logger.warn('Logout requested with invalid/expired refresh token string');
      }
    }
    return { message: 'Logged out successfully' };
  }

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
