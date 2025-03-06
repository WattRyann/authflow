// tests/logoutHandler.test.ts

import { NextRequest } from 'next/server';
import { POST } from '@/app/_api/v1/auth/logout/route';
import { logout } from '@/services/logoutService';
import { ErrorCodes } from '@/types/api';
import { APIError } from '@/middleware/errorHandler';
import { extractTokenFromRequest } from '@/middleware/authMiddleware';

// Mock your dependencies
jest.mock('@/services/logoutService');
jest.mock('@/middleware/authMiddleware', () => ({
  // Keep the actual implementation of withAuth if needed, or mock it out
  withAuth: jest.fn(<T>(handler: (req: NextRequest) => Promise<T>) => handler),
  extractTokenFromRequest: jest.fn()
}));

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    // 使用标准ResponseInit类型
    json: jest.fn((body: unknown, init?: ResponseInit) => ({ body, init }))
  }
}));
jest.mock('@/i18n', () => ({
  t: jest.fn().mockImplementation((key: string) => key)
}));

describe('logoutHandler', () => {
  let mockRequest: Partial<NextRequest>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {};
  });

  it('should return an error response if no access token is found', async () => {
    // Setup: extractTokenFromRequest returns undefined/null
    (extractTokenFromRequest as jest.Mock).mockReturnValue(null);

    // Call handler
    const response = await POST(mockRequest as NextRequest);

    // Assertions
    expect(extractTokenFromRequest).toHaveBeenCalledWith(mockRequest);
    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        message: 'auth.errors.invalidToken',
        code: ErrorCodes.INVALID_TOKEN
      },
      init: { status: 401 }
    });
  });

  it('should successfully logout when an access token is provided and logout service does not throw', async () => {
    // Setup
    (extractTokenFromRequest as jest.Mock).mockReturnValue('valid-access-token');
    // No error thrown by logout
    (logout as jest.Mock).mockResolvedValue(undefined);

    // Mock request body with a refresh token
    const mockJson = jest.fn().mockResolvedValue({ refresh_token: 'valid-refresh-token' });
    mockRequest.json = mockJson;

    // Call handler
    const response = await POST(mockRequest as NextRequest);

    expect(extractTokenFromRequest).toHaveBeenCalledWith(mockRequest);
    expect(logout).toHaveBeenCalledWith('valid-access-token', { refresh_token: 'valid-refresh-token' });
    
    // Verify success response
    expect(response).toEqual({
      body: {
        status: 'success',
        data: { success: true },
        message: 'auth.logoutSuccess'
      },
      init: { status: 200 }
    });
  });

  it('should handle APIError thrown by logout service', async () => {
    (extractTokenFromRequest as jest.Mock).mockReturnValue('valid-access-token');
    const apiError = new APIError(403, ErrorCodes.INVALID_TOKEN, 'Forbidden');
    
    (logout as jest.Mock).mockRejectedValue(apiError);

    // Call handler
    const response = await POST(mockRequest as NextRequest);

    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        message: 'Forbidden',
        code: ErrorCodes.INVALID_TOKEN
      },
      init: { status: 403 }
    });
  });

  it('should handle unknown errors as invalid token', async () => {
    (extractTokenFromRequest as jest.Mock).mockReturnValue('valid-access-token');
    
    (logout as jest.Mock).mockRejectedValue(new Error('Unknown error'));

    // Call handler
    const response = await POST(mockRequest as NextRequest);

    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        message: 'auth.errors.invalidToken',
        code: ErrorCodes.INVALID_TOKEN
      },
      init: { status: 401 }
    });
  });

  it('should parse request body safely', async () => {
    (extractTokenFromRequest as jest.Mock).mockReturnValue('valid-access-token');
    (logout as jest.Mock).mockResolvedValue(undefined);

    // If request.json() throws
    const mockJson = jest.fn().mockRejectedValue(new Error('Invalid JSON'));
    mockRequest.json = mockJson;

    const response = await POST(mockRequest as NextRequest);

    // No error, just treat body as empty
    expect(mockJson).toHaveBeenCalled();
    expect(logout).toHaveBeenCalledWith('valid-access-token', { refresh_token: undefined });
    expect(response).toEqual({
      body: {
        status: 'success',
        data: { success: true },
        message: 'auth.logoutSuccess'
      },
      init: { status: 200 }
    });
  });
});
