import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/services/authService';
import { LoginRequest, APIResponse } from '@/types/api';
import { handleError } from '@/middleware/errorHandler';
import { loginLimiter } from '@/middleware/rateLimit';
import { ErrorCodes, LoginData } from '@/types/api';
import { APIError } from '@/middleware/errorHandler';
import i18n from '@/i18n';

/**
 * Extracts the client IP from the request headers.
 * @param request - The NextRequest object.
 * @returns The client's IP address or 'unknown' if not available.
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    'unknown'
  );
}

/**
 * Handles the login POST request.
 * Applies rate limiting based on the client's IP and username,
 * processes the login, and returns a standardized JSON response.
 *
 * @param request - The NextRequest object containing the login data.
 * @returns A NextResponse containing the APIResponse with login details or error information.
 */
export async function POST(request: NextRequest): Promise<NextResponse<APIResponse<LoginData | null>>> {
  let requestBody: LoginRequest | null = null;
  
  try {
    // Parse and store the request body once
    requestBody = await request.json() as LoginRequest;
    const { username } = requestBody;

    // Apply rate limiting (based on username and IP)
    const ip = getClientIp(request);
    const rateLimitKey = `${ip}-${username}`;
    const rateLimitResult = await loginLimiter.check(request, rateLimitKey);
    
    if (!rateLimitResult.success) {
      const response: APIResponse<null> = {
        status: 'error',
        data: null,
        message: i18n.t('auth.errors.rateLimitExceeded'),
        code: ErrorCodes.RATE_LIMIT_EXCEEDED
      };
      return NextResponse.json(response, { status: 429 });
    }

    // Process login request
    const loginData = await login(requestBody);

    // Return successful login response
    const response: APIResponse<typeof loginData> = {
      status: 'success',
      data: loginData,
      message: i18n.t('auth.messages.loginSuccess')
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error: unknown) {
    // Use the already parsed body if available
    const username = requestBody?.username || 'unknown';

    // Record failure attempts specifically for authentication failures
    if (error instanceof APIError && error.code === ErrorCodes.INVALID_CREDENTIALS) {
      const ip = getClientIp(request);
      const rateLimitKey = `${ip}-${username}`;
      // Ensure that this method call correctly registers a failed attempt.
      await loginLimiter.check(request, rateLimitKey);
    }
    
    return handleError(error);
  }
}
