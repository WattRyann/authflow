import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route'; // Adjust to the actual path
import { forgotPasswordLimiter } from '@/middleware/rateLimit';
import { forgotPassword } from '@/services/passwordService';
import { ErrorCodes } from '@/types/api';
import { handleError } from '@/middleware/errorHandler';

// Mock i18n for internationalization
jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: { [key: string]: string } = {
      'auth.errors.rateLimitExceeded': 'Too many requests, please try again later',
      'auth.errors.resetEmailSent': 'If the email exists, a password reset email has been sent'
    };
    return translations[key] || key;
  }
}));

// Mock dependencies for testing
jest.mock('@/middleware/rateLimit', () => ({
  forgotPasswordLimiter: {
    check: jest.fn()
  }
}));

jest.mock('@/services/passwordService', () => ({
  forgotPassword: jest.fn()
}));

jest.mock('@/middleware/errorHandler', () => ({
  handleError: jest.fn()
}));

/**
 * Test suite for the POST handler of the forgot password endpoint.
 */
describe('POST handler', () => {
  const fakeEmail = 'test@example.com';
  const fakeBody = { email: fakeEmail };
  let fakeRequest: NextRequest;

  /**
   * Setup executed before each test to initialize mocks and request object.
   */
  beforeEach(() => {
    // Mock NextRequest with json and headers.get methods
    fakeRequest = {
      json: jest.fn().mockResolvedValue(fakeBody),
      headers: {
        get: jest.fn()
      }
    } as unknown as NextRequest;

    jest.clearAllMocks();
  });

  /**
   * Test case: Verify that a 429 response is returned when the rate limit is exceeded.
   */
  it('should return 429 response when rate limit is exceeded', async () => {
    // Arrange: Mock rate limiter to indicate limit exceeded
    (forgotPasswordLimiter.check as jest.Mock).mockResolvedValue({
      success: false,
      current: 11,
      remaining: 0
    });

    // Act: Invoke the POST handler
    const response = await POST(fakeRequest);
    const json = await response.json();

    // Assert: Validate response details
    expect(response.status).toBe(429);
    expect(json).toEqual({
      status: 'error',
      data: null,
      message: 'Too many requests, please try again later',
      code: ErrorCodes.RATE_LIMIT_EXCEEDED
    });
  });

  /**
   * Test case: Verify that forgotPassword is called and a success response is returned when rate limit passes.
   */
  it('should call forgotPassword and return success response when rate limit passes', async () => {
    // Arrange: Mock rate limiter to allow request and password service to succeed
    (forgotPasswordLimiter.check as jest.Mock).mockResolvedValue({
      success: true,
      current: 1,
      remaining: 9
    });
    (forgotPassword as jest.Mock).mockResolvedValue(undefined);

    // Act: Invoke the POST handler
    const response = await POST(fakeRequest);
    const json = await response.json();

    // Assert: Validate response and function calls
    expect(response.status).toBe(200);
    expect(json).toEqual({
      status: 'success',
      data: null,
      message: 'If the email exists, a password reset email has been sent'
    });
    expect(forgotPassword).toHaveBeenCalledWith({ email: fakeEmail });
  });

  /**
   * Test case: Verify that handleError is invoked when an exception occurs.
   */
  it('should call handleError when an exception occurs', async () => {
    const testError = new Error('Test error');

    // Arrange: Mock request.json to throw an error and handleError to return a response
    (fakeRequest.json as jest.Mock).mockRejectedValue(testError);
    const errorResponse = NextResponse.json({ error: 'Handled error' }, { status: 500 });
    (handleError as jest.Mock).mockReturnValue(errorResponse);

    // Act: Invoke the POST handler
    const response = await POST(fakeRequest);

    // Assert: Verify error handling behavior
    expect(handleError).toHaveBeenCalledWith(testError);
    expect(response).toEqual(errorResponse);
  });
});