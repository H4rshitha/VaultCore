import { AuthService } from '../services/authService.js';
import { ApiResponse } from '@vaultcore/shared';
import { parseCookies } from '../validators/authValidators.js';

const authService = new AuthService();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  static async signup(req, res, next) {
    try {
      const result = await authService.signup(req.body);
      const refreshToken = result.tokens?.refreshToken;
      if (refreshToken) {
        res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
      }
      return ApiResponse.created(res, 'User registered successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      const refreshToken = result.tokens?.refreshToken;
      if (refreshToken) {
        res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
      }
      return ApiResponse.success(res, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req, res, next) {
    try {
      const cookies = parseCookies(req.headers?.cookie);
      const token = req.body?.refreshToken || req.refreshToken || cookies?.refreshToken;
      const result = await authService.refreshToken(token);
      const newRefreshToken = result.tokens?.refreshToken;
      if (newRefreshToken) {
        res.cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS);
      }
      return ApiResponse.success(res, 'Token refreshed successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async logout(req, res, next) {
    try {
      const cookies = parseCookies(req.headers?.cookie);
      const token = req.body?.refreshToken || req.refreshToken || cookies?.refreshToken;
      if (token) {
        await authService.logout(token);
      }
      res.clearCookie('refreshToken', { path: '/' });
      return ApiResponse.success(res, 'Logout successful', { success: true });
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const result = await authService.getProfile(req.user.userId);
      return ApiResponse.success(res, 'Profile retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
