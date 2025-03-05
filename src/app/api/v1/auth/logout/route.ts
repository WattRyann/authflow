import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/services/logoutService';
import { LogoutRequest, APIResponse, LogoutData, ErrorCodes } from '@/types/api';
import { jsonError, jsonSuccess } from '@/utils/apiResponse';

import i18n from '@/i18n';
import { withAuth, extractTokenFromRequest } from '@/middleware/authMiddleware';
import { APIError } from '@/middleware/errorHandler';

/**
 * Handler for processing logout requests.
 * @param request - The incoming NextRequest object containing request details.
 * @returns A Promise resolving to a NextResponse with logout result.
 */
async function logoutHandler(
  request: NextRequest
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
