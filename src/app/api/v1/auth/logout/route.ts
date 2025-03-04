import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/services/logoutService';
import { LogoutRequest, APIResponse, LogoutData, ErrorCodes } from '@/types/api';
import i18n from '@/i18n';
import { withAuth, extractTokenFromRequest } from '@/middleware/authMiddleware';
import { APIError } from '@/middleware/errorHandler';

/**
 * Helper function to create a consistent JSON error response.
 * @param message - The error message to be returned.
 * @param code - The error code from predefined ErrorCodes.
 * @param status - The HTTP status code for the response.
 * @returns A NextResponse object with error details in JSON format.
 */
export function jsonError(message: string, code: ErrorCodes, status: number): NextResponse<APIResponse<null>> {
  return NextResponse.json({
    status: 'error',
    data: null,
    message,
    code,
  }, { status });
}

/**
 * Helper function to create a consistent JSON success response.
 * @param data - The data payload to be returned, or null if none.
 * @param message - The success message to be returned.
 * @returns A NextResponse object with success details in JSON format and 200 status.
 */
export function jsonSuccess<T>(data: T | null, message: string): NextResponse<APIResponse<T>> {
  return NextResponse.json({
    status: 'success',
    data,
    message,
  }, { status: 200 });
}

/**
 * Handler for processing logout requests.
 * @param request - The incoming NextRequest object containing request details.
 * @param userId - The ID of the authenticated user performing the logout.
 * @returns A Promise resolving to a NextResponse with logout result.
 */
export async function logoutHandler(
  request: NextRequest,
  userId: number
): Promise<NextResponse<APIResponse<LogoutData | null>>> {
  try {
    // Extract the access token from request headers
    const accessToken = extractTokenFromRequest(request);
    if (!accessToken) {
      return jsonError(i18n.t('auth.errors.invalidToken'), ErrorCodes.INVALID_TOKEN, 401);
    }

    // Parse the request body to retrieve an optional refresh token
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Request body can be empty or invalid JSON, proceed regardless
    }

    const refreshToken = (body as Partial<LogoutRequest>)?.refresh_token;
    const params: LogoutRequest = { refresh_token: refreshToken };

    // Execute the logout service with provided tokens
    await logout(accessToken, params);

    // Return a success response upon successful logout
    return jsonSuccess<LogoutData>({ success: true }, i18n.t('auth.logoutSuccess'));
  } catch (error: unknown) {
    // Log errors in non-test environments for debugging purposes
    if (process.env.NODE_ENV !== 'test') {
      console.error('Logout route error:', error);
    }

    // Handle known APIError instances with specific details
    if (error instanceof APIError) {
      return jsonError(error.message, error.code as ErrorCodes, error.statusCode);
    }

    // Default to treating unknown errors as invalid token errors
    return jsonError(i18n.t('auth.errors.invalidToken'), ErrorCodes.INVALID_TOKEN, 401);
  }
}

// Export the POST handler wrapped with authentication middleware
export const POST = withAuth(logoutHandler);