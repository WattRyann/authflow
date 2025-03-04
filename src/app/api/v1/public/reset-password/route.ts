import { NextRequest, NextResponse } from 'next/server';
import { resetPasswordLimiter } from '@/middleware/rateLimit';
import { resetPassword } from '@/services/passwordService';
import { ErrorCodes, ResetPasswordRequest, APIResponse } from '@/types/api';
import { handleError } from '@/middleware/errorHandler';
import i18n from '@/i18n';

/**
 * Handles the reset password POST request.
 *
 * This endpoint applies rate limiting based on the reset token to prevent abuse.
 * It parses the incoming request body, extracts the reset token and the new password,
 * and calls the service to process the password reset. On success, a standardized response
 * is returned; any errors are delegated to the centralized error handler.
 *
 * @param request - The NextRequest object containing the password reset data.
 * @returns A NextResponse containing an APIResponse with null data on success.
 */
export async function POST(request: NextRequest): Promise<NextResponse<APIResponse<null>>> {
  try {
    // Parse the request body as a ResetPasswordRequest
    const body = await request.json() as ResetPasswordRequest;
    const { token, new_password } = body;

    // Apply rate limiting based on the reset token to mitigate abuse
    const rateLimitResult = await resetPasswordLimiter.check(request, token);
    if (!rateLimitResult.success) {
      const response: APIResponse<null> = {
        status: 'error',
        data: null,
        message: i18n.t('auth.errors.rateLimitExceeded'),
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      };
      return NextResponse.json(response, { status: 429 });
    }

    // Process the password reset request using the provided token and new password
    await resetPassword(token, new_password);

    // Return a standardized success response
    const response: APIResponse<null> = {
      status: 'success',
      data: null,
      message: i18n.t('auth.messages.passwordResetSuccess'),
    };
    return NextResponse.json(response, { status: 200 });

  } catch (error: unknown) {
    // Delegate any errors to the centralized error handler
    return handleError(error);
  }
}
