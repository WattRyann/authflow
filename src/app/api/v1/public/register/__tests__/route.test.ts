import { NextRequest, NextResponse } from 'next/server';
import { registerLimiter } from '@/middleware/rateLimit';
import { register } from '@/services/userService';
import { ErrorCodes } from '@/types/api';
import { handleError } from '@/middleware/errorHandler';
import { POST } from '../route';

// Mock i18n for internationalization
jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: { [key: string]: string } = {
      'auth.errors.rateLimitExceeded': 'Too many requests, please try again later',
      'auth.success.registration': 'User registered successfully'
    };
    return translations[key] || key;
  }
}));

// Mock dependencies for testing
jest.mock('@/middleware/rateLimit');
jest.mock('@/services/userService');
jest.mock('@/middleware/errorHandler');

/**
 * Test suite for the POST /api/v1/public/register endpoint.
 */
describe('POST /api/v1/public/register', () => {
  let mockRequest: NextRequest;

  /**
   * Setup executed before each test to initialize mocks and request object.
   */
  beforeEach(() => {
    // Reset all mocks to ensure a clean state
    jest.clearAllMocks();

    // Create a mock request with valid registration data
    mockRequest = new NextRequest('http://localhost:3000/api/v1/public/register', {
      method: 'POST',
      body: JSON.stringify({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123'
      })
    });

    // Mock registerLimiter.check to return success
    (registerLimiter.check as jest.Mock).mockResolvedValue({ success: true });

    // Mock register to return a successful response
    (register as jest.Mock).mockResolvedValue({
      user_id: '1',
      username: 'testuser',
      email: 'test@example.com'
    });

    // Mock handleError to return a structured error response
    (handleError as jest.Mock).mockImplementation((error) => {
      return NextResponse.json(
        {
          status: 'error',
          message: error.message,
          code: error.code || ErrorCodes.INTERNAL_SERVER_ERROR
        },
        { status: error.statusCode || 500 }
      );
    });
  });

  /**
   * Test case: Verify successful registration of a new user.
   */
  it('should successfully register a new user', async () => {
    // Act: Invoke the POST handler
    const response = await POST(mockRequest);
    const data = await response.json();

    // Assert: Validate response details
    expect(response.status).toBe(201);
    expect(data).toEqual({
      status: 'success',
      data: {
        user_id: '1',
        username: 'testuser',
        email: 'test@example.com'
      },
      message: 'User registered successfully'
    });
  });

  /**
   * Test case: Verify that a 429 response is returned when the rate limit is exceeded.
   */
  it('should return 429 when rate limit is exceeded', async () => {
    // Arrange: Mock rate limiter to indicate limit exceeded
    (registerLimiter.check as jest.Mock).mockResolvedValue({ success: false });

    // Act: Invoke the POST handler
    const response = await POST(mockRequest);
    const data = await response.json();

    // Assert: Validate rate limit response and ensure register is not called
    expect(response.status).toBe(429);
    expect(data).toEqual({
      status: 'error',
      data: null,
      message: 'Too many requests, please try again later',
      code: ErrorCodes.RATE_LIMIT_EXCEEDED
    });
    expect(register).not.toHaveBeenCalled();
  });

  /**
   * Test case: Verify handling of an invalid JSON request body.
   */
  it('should handle invalid JSON request body', async () => {
    // Arrange: Create a request with invalid JSON
    const invalidRequest = new NextRequest('http://localhost:3000/api/v1/public/register', {
      method: 'POST',
      body: 'invalid json'
    });

    const jsonError = new SyntaxError('Invalid JSON');
    (handleError as jest.Mock).mockReturnValue(
      NextResponse.json(
        {
          status: 'error',
          message: 'Invalid request data',
          code: ErrorCodes.INVALID_REQUEST
        },
        { status: 500 }
      )
    );

    // Act: Invoke the POST handler
    const response = await POST(invalidRequest);
    const data = await response.json();

    // Assert: Validate error handling for invalid JSON
    expect(response.status).toBe(500);
    expect(data).toEqual({
      status: 'error',
      message: 'Invalid request data',
      code: ErrorCodes.INVALID_REQUEST
    });
    expect(handleError).toHaveBeenCalledWith(jsonError);
  });

  /**
   * Test case: Verify handling of registration errors.
   */
  it('should handle registration errors', async () => {
    // Arrange: Mock register to simulate a failure
    const error = new Error('Registration failed');
    (register as jest.Mock).mockRejectedValue(error);

    // Act: Invoke the POST handler
    await POST(mockRequest);

    // Assert: Verify error handling behavior
    expect(handleError).toHaveBeenCalledWith(error);
  });
});