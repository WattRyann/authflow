import { PrismaClient } from '@prisma/client';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes, LogoutRequest } from '@/types/api';
import i18n from '@/i18n';
import defaultPrisma from '@/lib/prisma';
import { verifyAccessToken, verifyRefreshToken } from '@/utils/jwt';
import { TOKEN_EXPIRY_MS } from '@/constants/auth';

/**
 * Processes a user logout request.
 * 
 * Steps:
 * 1. Verifies the access token and extracts the user ID and token ID (jti).
 * 2. Blacklists the access token by creating a record with an expiry time.
 * 3. If a refresh token is provided:
 *    a. Verifies the refresh token.
 *    b. Blacklists the refresh token.
 *    c. Deletes the refresh token record from the database.
 * 
 * Security Considerations:
 * - Even if a token is already blacklisted, no error is returned to avoid exposing sensitive details.
 * - Uses a transaction to ensure data consistency.
 * - Blacklisted tokens have an expiry time to prevent database bloat.
 *
 * @param {string} accessToken - The user's access token.
 * @param {LogoutRequest} params - Logout parameters, which may include a refresh token.
 * @param {PrismaClient} prisma - Optional Prisma client instance for dependency injection.
 * @returns {Promise<void>} Resolves when logout is successful.
 * @throws {APIError} If token verification fails or an error occurs during logout.
 */
export async function logout(
  accessToken: string,
  params: LogoutRequest = {},
  prisma: PrismaClient = defaultPrisma
): Promise<void> {
  try {
    // Verify the access token and extract user ID and token identifier (jti)
    const accessPayload = verifyAccessToken(accessToken);
    const { user_id, jti: accessJti } = accessPayload;

    // Use a transaction to ensure that all related database operations succeed or fail together.
    await prisma.$transaction(async (tx) => {
      // Blacklist the access token by creating a record in the blacklisted_Tokens table.
      await tx.blacklisted_Tokens.create({
        data: {
          user_id,
          token_identifier: accessJti,
          token_type: 'access',
          expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS)
        }
      });

      // Process the refresh token if provided.
      if (params.refresh_token) {
        try {
          // Verify the refresh token and extract its identifier (jti).
          const refreshPayload = await verifyRefreshToken(params.refresh_token, prisma);
          const { jti: refreshJti } = refreshPayload;

          // Blacklist the refresh token.
          await tx.blacklisted_Tokens.create({
            data: {
              user_id,
              token_identifier: refreshJti,
              token_type: 'refresh',
              expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS)
            }
          });

          // Remove the refresh token record from the database.
          await tx.refresh_Tokens.delete({
            where: { token: params.refresh_token }
          });
        } catch (refreshError) {
          // Log the error regarding the refresh token but continue with logout.
          console.warn('Invalid refresh token during logout:', refreshError);
        }
      }
    });
  } catch (error) {
    // If the error is already an APIError, rethrow it.
    if (error instanceof APIError) {
      throw error;
    }
    // Log the error for internal debugging without exposing details.
    console.error('Logout error:', error);
    throw new APIError(
      401,
      ErrorCodes.INVALID_TOKEN,
      i18n.t('auth.errors.invalidToken')
    );
  }
}
