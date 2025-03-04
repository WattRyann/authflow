import { NextRequest, NextResponse } from 'next/server';
import { getUserHandler } from '../route';
import { getCurrentUserInfo } from '@/services/userService';
import { ErrorCodes, UserInfo } from '@/types/api';
import { APIError } from '@/middleware/errorHandler';
import { extractTokenFromRequest } from '@/middleware/authMiddleware';

// Mock dependencies for testing
jest.mock('@/services/userService');
jest.mock('@/middleware/authMiddleware', () => ({
  withAuth: jest.fn((handler) => handler),
  extractTokenFromRequest: jest.fn()
}));
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((body, init) => ({ body, init }))
  }
}));
jest.mock('@/i18n', () => ({
  t: jest.fn().mockImplementation((key) => key)
}));

/**
 * Test suite for the getUserHandler function.
 */
describe('getUserHandler', () => {
  let mockRequest: Partial<NextRequest>;
  const mockUserId = 123;
  const mockUserInfo: UserInfo = {
    username: 'testuser',
    email: 'test@example.com',
    roles: ['user'],
    is_email_verified: true,
    two_factor_enabled: false
  };

  /**
   * Setup executed before each test to reset mocks and initialize variables.
   */
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {};
  });

  /**
   * Test case: Verify error response when no access token is provided.
   */
  it('should return an error response when no access token is present', async () => {
    // Arrange: Mock extractTokenFromRequest to return null
    (extractTokenFromRequest as jest.Mock).mockReturnValue(null);

    // Act: Invoke the handler
    const response = await getUserHandler(mockRequest as NextRequest, mockUserId);

    // Assert: Validate error response and ensure service is not called
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
    expect(getCurrentUserInfo).not.toHaveBeenCalled();
  });

  /**
   * Test case: Verify successful retrieval of user information.
   */
  it('should successfully retrieve and return user information', async () => {
    // Arrange: Mock token extraction and user info retrieval
    (extractTokenFromRequest as jest.Mock).mockReturnValue('valid-token');
    (getCurrentUserInfo as jest.Mock).mockResolvedValue(mockUserInfo);

    // Act: Invoke the handler
    const response = await getUserHandler(mockRequest as NextRequest, mockUserId);

    // Assert: Validate success response and function calls
    expect(extractTokenFromRequest).toHaveBeenCalledWith(mockRequest);
    expect(getCurrentUserInfo).toHaveBeenCalledWith(mockUserId);
    expect(response).toEqual({
      body: {
        status: 'success',
        data: mockUserInfo,
        message: 'user.messages.infoRetrieved'
      },
      init: { status: 200 }
    });
  });

  /**
   * Test case: Verify proper handling of APIError instances.
   */
  it('should correctly handle APIError', async () => {
    // Arrange: Mock token extraction and simulate an APIError
    (extractTokenFromRequest as jest.Mock).mockReturnValue('valid-token');
    const apiError = new APIError(404, ErrorCodes.USER_NOT_FOUND, 'User not found');
    (getCurrentUserInfo as jest.Mock).mockRejectedValue(apiError);

    // Act: Invoke the handler
    const response = await getUserHandler(mockRequest as NextRequest, mockUserId);

    // Assert: Validate error response matches APIError details
    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        message: 'User not found',
        code: ErrorCodes.USER_NOT_FOUND
      },
      init: { status: 404 }
    });
  });

  /**
   * Test case: Verify unknown errors are converted to internal server errors.
   */
  it('should convert unknown errors to internal server errors', async () => {
    // Arrange: Mock token extraction and simulate an unknown error
    (extractTokenFromRequest as jest.Mock).mockReturnValue('valid-token');
    (getCurrentUserInfo as jest.Mock).mockRejectedValue(new Error('Unknown error'));

    // Act: Invoke the handler
    const response = await getUserHandler(mockRequest as NextRequest, mockUserId);

    // Assert: Validate response reflects internal server error
    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        message: 'common.errors.internalServerError',
        code: ErrorCodes.INTERNAL_SERVER_ERROR
      },
      init: { status: 500 }
    });
  });

  /**
   * Test case: Verify errors are not logged in the test environment.
   */
  it('should not log errors in the test environment', async () => {
    // Arrange: Mock token extraction and simulate an error
    (extractTokenFromRequest as jest.Mock).mockReturnValue('valid-token');
    (getCurrentUserInfo as jest.Mock).mockRejectedValue(new Error('Test error'));
    const consoleSpy = jest.spyOn(console, 'error');

    // Act: Invoke the handler
    await getUserHandler(mockRequest as NextRequest, mockUserId);

    // Assert: Ensure console.error is not called in test environment
    expect(consoleSpy).not.toHaveBeenCalled();

    // Cleanup: Restore console spy
    consoleSpy.mockRestore();
  });
});