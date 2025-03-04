import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';
import { login } from '@/services/authService';
import { loginLimiter } from '@/middleware/rateLimit';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes, LoginRequest } from '@/types/api';
import { handleError } from '@/middleware/errorHandler';
import i18n from '@/i18n';

// Mock dependencies
jest.mock('@/services/authService');
jest.mock('@/middleware/rateLimit');
jest.mock('@/middleware/errorHandler');
jest.mock('@/i18n', () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        'auth.errors.rateLimitExceeded': 'Too many requests, please try again later',
        'auth.errors.resetEmailSent': 'If the email exists, a password reset email has been sent'
      };
      return translations[key] || key;
    }
  }));

describe('Login Route Handler', () => {
  let mockRequest: NextRequest;
  const mockLoginData = {
    access_token: 'test_token',
    refresh_token: 'test_refresh',
    expires_in: 3600
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock request with proper headers implementation
    mockRequest = {
      json: jest.fn(),
      headers: {
        get: jest.fn((header: string) => {
          const headers: Record<string, string> = {
            'x-real-ip': '127.0.0.1'
          };
          return headers[header] || null;
        })
      }
    } as unknown as NextRequest;

    // Mock loginLimiter
    (loginLimiter.check as jest.Mock).mockResolvedValue({ success: true });

    // Mock login service
    (login as jest.Mock).mockResolvedValue(mockLoginData);

    // Mock handleError
    (handleError as jest.Mock).mockImplementation((error) => {
      return NextResponse.json({ error: error.message }, { status: 500 });
    });
  });

  it('should successfully handle login request', async () => {
    const mockBody = { username: 'testuser', password: 'password123' };
    (mockRequest.json as jest.Mock).mockResolvedValue(mockBody);

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: 'success',
      data: mockLoginData,
      message: 'auth.messages.loginSuccess'
    });
    expect(login).toHaveBeenCalledWith(mockBody);
  });

  it('should return 429 error when rate limit is exceeded', async () => {
    const mockBody = { username: 'testuser', password: 'password123' };
    (mockRequest.json as jest.Mock).mockResolvedValue(mockBody);
    (loginLimiter.check as jest.Mock).mockResolvedValue({ success: false });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data).toEqual({
      status: 'error',
      data: null,
      message: 'Too many requests, please try again later',
      code: ErrorCodes.RATE_LIMIT_EXCEEDED
    });
  });

  it('should handle errors thrown by login service', async () => {
    const mockBody = { username: 'testuser', password: 'password123' };
    (mockRequest.json as jest.Mock).mockResolvedValue(mockBody);
    const mockError = new APIError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid credentials');
    (login as jest.Mock).mockRejectedValue(mockError);

    await POST(mockRequest);

    expect(loginLimiter.check).toHaveBeenCalledTimes(1); // Only initial check
    expect(handleError).toHaveBeenCalledWith(mockError);
  });

  it('should handle request body parsing errors', async () => {
    (mockRequest.json as jest.Mock).mockRejectedValue(new Error('Invalid JSON'));

    await POST(mockRequest);

    expect(handleError).toHaveBeenCalled();
    expect(loginLimiter.check).not.toHaveBeenCalled();
  });

  it('should use "unknown" when IP header is missing', async () => {
    const mockBody = { username: 'testuser', password: 'password123' };
    mockRequest.headers.get = jest.fn().mockReturnValue(null);
    (mockRequest.json as jest.Mock).mockResolvedValue(mockBody);

    await POST(mockRequest);

    expect(loginLimiter.check).toHaveBeenCalledWith(
      mockRequest,
      'unknown-testuser'
    );
  });

  it('should prioritize x-real-ip header', async () => {
    const mockBody = { username: 'testuser', password: 'password123' };
    mockRequest.headers.get = jest.fn((header: string) => {
      const headers: Record<string, string> = {
        'x-real-ip': '1.1.1.1',
        'x-forwarded-for': '2.2.2.2'
      };
      return headers[header] || null;
    });
    (mockRequest.json as jest.Mock).mockResolvedValue(mockBody);

    await POST(mockRequest);

    expect(loginLimiter.check).toHaveBeenCalledWith(
      mockRequest,
      '1.1.1.1-testuser'
    );
  });
});