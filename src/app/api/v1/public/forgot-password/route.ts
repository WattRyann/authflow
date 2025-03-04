import { NextRequest, NextResponse } from 'next/server';
import { forgotPasswordLimiter } from '@/middleware/rateLimit';
import { forgotPassword } from '@/services/passwordService';
import { ForgotPasswordRequest, ErrorCodes, APIResponse } from '@/types/api';
import { handleError } from '@/middleware/errorHandler';
import i18n from '@/i18n';

/**
 * Handles the forgot password POST request.
 *
 * This endpoint applies rate limiting based on the email address provided
 * in the request body to prevent abuse. It then processes the forgot password
 * request and returns a standardized response. Regardless of whether the email
 * exists or not, a success response is sent to avoid leaking user information.
 *
 * @param request - The incoming NextRequest object.
 * @returns A NextResponse containing an APIResponse with a null data field.
 */
export async function POST(request: NextRequest): Promise<NextResponse<APIResponse<null>>> {
  try {
    // Parse the request body as a ForgotPasswordRequest
    const body = await request.json() as ForgotPasswordRequest;
    const { email } = body;

    // Apply rate limiting based on the provided email address.
    const rateLimitResult = await forgotPasswordLimiter.check(request, email);
    if (!rateLimitResult.success) {
      const response: APIResponse<null> = {
        status: 'error',
        data: null,
        message: i18n.t('auth.errors.rateLimitExceeded'),
        code: ErrorCodes.RATE_LIMIT_EXCEEDED
      };
      return NextResponse.json(response, { status: 429 });
    }

    // Process the forgot password request.
    await forgotPassword({ email });

    // Return a success response regardless of whether the email exists.
    // This approach prevents leaking information about registered emails.
    const response: APIResponse<null> = {
      status: 'success',
      data: null,
      message: i18n.t('auth.errors.resetEmailSent')
    };
    return NextResponse.json(response, { status: 200 });
    
  } catch (error: unknown) {
    return handleError(error);
  }
}
