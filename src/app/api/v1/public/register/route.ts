import { NextRequest, NextResponse } from 'next/server';
import { registerLimiter } from '@/middleware/rateLimit';
import { register } from '@/services/userService';
import { APIResponse, RegisterRequest, RegisterResponse, ErrorCodes } from '@/types/api';
import { handleError } from '@/middleware/errorHandler';
import i18n from '@/i18n';

/**
 * Handles user registration requests.
 *
 * This endpoint applies rate limiting to prevent abuse, parses and validates the
 * registration request payload, and attempts to register a new user. On successful
 * registration, a standardized response with a 201 status code is returned.
 * In case of errors, the error is handled by a centralized error handler.
 *
 * @param request - The NextRequest object containing the registration data.
 * @returns A NextResponse containing an APIResponse with either the registration result or error details.
 */
export async function POST(request: NextRequest): Promise<NextResponse<APIResponse<RegisterResponse | null>>> {
  try {
    // Apply rate limiting
    const rateLimitResult = await registerLimiter.check(request);
    if (!rateLimitResult.success) {
      const response: APIResponse<null> = {
        status: 'error',
        data: null,
        message: i18n.t('auth.errors.rateLimitExceeded'),
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      };
      return NextResponse.json(response, { status: 429 });
    }

    // Parse and validate the request body
    const body = await request.json() as RegisterRequest;
    
    // Register the user
    const result = await register(body);

    // Return a standardized response upon successful registration
    const response: APIResponse<RegisterResponse> = {
      status: 'success',
      data: result,
      message: i18n.t('auth.success.registration'),
    };
    return NextResponse.json(response, { status: 201 });
    
  } catch (error: unknown) {
    // Delegate error handling to the centralized error handler
    return handleError(error);
  }
}
