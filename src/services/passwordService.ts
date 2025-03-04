import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/utils/bcrypt';
import { validateEmail, validatePassword } from '@/utils/validation';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes, ForgotPasswordRequest } from '@/types/api';
import { sendPasswordResetEmail } from '@/utils/mailer';
import crypto from 'crypto';
import i18n from '@/i18n';
import defaultPrisma from '@/lib/prisma';
import { TOKEN_BYTE_LENGTH, TOKEN_EXPIRY_MS } from '@/constants/auth';

/**
 * Handles a forgot password request.
 *
 * Process:
 * 1. Validates the provided email format.
 * 2. Begins a transaction:
 *    a. Looks up the user by email.
 *    b. If no user is found, exit silently to prevent enumeration.
 *    c. Checks for an existing valid (not expired, not used) reset request.
 *    d. Reuses the existing token if found; otherwise, generates a new token.
 * 3. Sends a password reset email with the token.
 *
 * @param {ForgotPasswordRequest} params - An object containing the user's email.
 * @param {PrismaClient} prisma - Optional Prisma client instance for dependency injection.
 * @returns {Promise<void>}
 * @throws {APIError} If the email format is invalid or if an internal error occurs.
 */
export async function forgotPassword(
  { email }: ForgotPasswordRequest,
  prisma: PrismaClient = defaultPrisma
): Promise<void> {
  // Validate email format.
  if (!validateEmail(email)) {
    throw new APIError(
      400,
      ErrorCodes.INVALID_EMAIL,
      i18n.t('auth.errors.invalidEmail'),
      { field: 'email', reason: 'Invalid format' }
    );
  }

  try {
    // Execute within a transaction to ensure data consistency.
    await prisma.$transaction(async (tx) => {
      // Look up the user by email.
      const user = await tx.users.findUnique({
        where: { email }
      });

      // Do not reveal if the email is unregistered.
      if (!user) {
        return;
      }

      // Check for an existing, valid password reset request.
      const existingRequest = await tx.password_Resets.findFirst({
        where: {
          user_id: user.id,
          expires_at: { gt: new Date() },
          is_used: false
        }
      });

      // If a valid reset request exists, reuse the token.
      if (existingRequest) {
        await sendPasswordResetEmail(email, existingRequest.token);
        return;
      }

      // Generate a new secure token.
      const token = crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex');

      // Create a new password reset record.
      await tx.password_Resets.create({
        data: {
          user_id: user.id,
          token,
          expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS),
          is_used: false
        }
      });

      // Send the password reset email.
      await sendPasswordResetEmail(email, token);
    });
  } catch (error) {
    console.error('Password reset error:', error);
    throw new APIError(
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      i18n.t('auth.errors.resetEmailFailed')
    );
  }
}

/**
 * Resets a user's password using a valid reset token.
 *
 * Process:
 * 1. Validates the new password format.
 * 2. Begins a transaction:
 *    a. Finds and validates the reset token (exists, not expired, not used).
 *    b. Generates a new password hash.
 *    c. Updates the user's password and timestamps.
 *    d. Marks the reset token as used.
 *    e. Blacklists all existing access and refresh tokens for the user.
 *
 * @param {string} token - The password reset token.
 * @param {string} newPassword - The new password.
 * @param {PrismaClient} prisma - Optional Prisma client instance for dependency injection.
 * @returns {Promise<void>}
 * @throws {APIError} If the token is invalid/expired or the new password format is invalid.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
  prisma: PrismaClient = defaultPrisma
): Promise<void> {
  // Validate the new password format.
  if (!validatePassword(newPassword)) {
    throw new APIError(
      400,
      ErrorCodes.INVALID_PASSWORD,
      i18n.t('auth.errors.invalidPassword'),
      { field: 'new_password', reason: 'Invalid format' }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Find the password reset request and include the associated user.
      const resetRequest = await tx.password_Resets.findFirst({
        where: {
          token,
          expires_at: { gt: new Date() },
          is_used: false
        },
        include: { user: true }
      });

      // If no valid reset request is found, throw an error.
      if (!resetRequest) {
        throw new APIError(
          401,
          ErrorCodes.INVALID_RESET_TOKEN,
          i18n.t('auth.errors.invalidResetToken')
        );
      }

      // Generate a hash for the new password.
      const hashedPassword = await hashPassword(newPassword);

      // Update the user's password and related timestamps.
      await tx.users.update({
        where: { id: resetRequest.user_id },
        data: {
          password_hash: hashedPassword,
          password_changed_at: new Date(),
          updated_at: new Date()
        }
      });

      // Mark the reset token as used.
      await tx.password_Resets.update({
        where: { id: resetRequest.id },
        data: { is_used: true }
      });

      // Blacklist all existing access and refresh tokens for the user.
      await tx.blacklisted_Tokens.createMany({
        data: [
          {
            user_id: resetRequest.user_id,
            token_type: 'access',
            token_identifier: '*', // Wildcard to blacklist all access tokens.
            expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS)
          },
          {
            user_id: resetRequest.user_id,
            token_type: 'refresh',
            token_identifier: '*', // Wildcard to blacklist all refresh tokens.
            expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS)
          }
        ]
      });
    });
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    console.error('Password reset error:', error);
    throw new APIError(
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      i18n.t('auth.errors.resetPasswordFailed')
    );
  }
}
