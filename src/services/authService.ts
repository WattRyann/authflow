import { PrismaClient } from '@prisma/client';
import { comparePassword } from '@/utils/bcrypt';
import { validateUsername } from '@/utils/validation';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes, LoginRequest, LoginData } from '@/types/api';
import { generateTokens } from '@/utils/jwt';
import { verify2FAToken } from '@/utils/2fa';
import i18n from '@/i18n';
import defaultPrisma from '@/lib/prisma';

/**
 * User login service.
 * 
 * Logic:
 * 1. Validate username format.
 * 2. Find the user and verify the password.
 * 3. If 2FA is enabled, verify the provided 2FA code.
 * 4. Generate access and refresh tokens.
 * 
 * Security considerations:
 * - Uses timing-safe comparisons for password and 2FA verification.
 * - Returns generic error messages to avoid user enumeration.
 * 
 * @param {LoginRequest} params - The login request parameters.
 * @param {PrismaClient} prisma - Prisma client instance (optional, for dependency injection).
 * @returns {Promise<LoginData>} - Token information upon successful login.
 * @throws {APIError} - Throws an error when login fails.
 */
export async function login(
  { username, password, two_factor_code }: LoginRequest,
  prisma: PrismaClient = defaultPrisma
): Promise<LoginData> {
  // Validate username format.
  if (!validateUsername(username)) {
    throw new APIError(
      400,
      ErrorCodes.INVALID_USERNAME,
      i18n.t('auth.errors.invalidUsername')
    );
  }

  try {
    // Find the user and include two-factor settings.
    const user = await prisma.users.findUnique({
      where: { username },
      include: {
        twoFactorSettings: true // Ensure this matches your Prisma schema's relation.
      }
    });

    // If user doesn't exist or password doesn't match, throw an error.
    if (!user || !(await comparePassword(password, user.password_hash))) {
      throw new APIError(
        401,
        ErrorCodes.INVALID_CREDENTIALS,
        i18n.t('auth.errors.invalidCredentials')
      );
    }

    // If 2FA is enabled, verify the 2FA code.
    if (user.twoFactorSettings?.is_enabled) {
      if (!two_factor_code) {
        throw new APIError(
          401,
          ErrorCodes.TWO_FACTOR_REQUIRED,
          i18n.t('auth.errors.twoFactorRequired'),
          { requires2FA: true }
        );
      }

      // Optionally, check if the 2FA secret exists.
      if (!user.twoFactorSettings.secret) {
        throw new APIError(
          500,
          ErrorCodes.INTERNAL_SERVER_ERROR,
          i18n.t('auth.errors.configurationError')
        );
      }

      const isValid = await verify2FAToken(
        user.twoFactorSettings.secret,
        two_factor_code
      );

      if (!isValid) {
        throw new APIError(
          401,
          ErrorCodes.INVALID_2FA_CODE,
          i18n.t('auth.errors.invalid2FACode')
        );
      }
    }

    // Generate tokens.
    const tokens = await generateTokens(user.id);

    // Return login data.
    return {
      access_token: tokens.accessToken,
      token_type: 'bearer',
      refresh_token: tokens.refreshToken,
      expires_in: 3600, // Token expiry in seconds (1 hour).
      requires2FA: false
    };

  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    console.error('Login error:', error);
    throw new APIError(
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      i18n.t('auth.errors.loginFailed')
    );
  }
}
