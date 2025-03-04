import { NextRequest } from 'next/server';
import { patchHandler } from '../route';
import { changePassword } from '@/services/userService';
import { ErrorCodes } from '@/types/api';
import { APIError } from '@/middleware/errorHandler';
import { extractTokenFromRequest } from '@/middleware/authMiddleware';
import { passwordLimiter } from '@/middleware/rateLimit';

// Mock dependencies
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
jest.mock('@/middleware/rateLimit');
jest.mock('@/i18n', () => ({
  t: jest.fn((key) => key)
}));

describe('patchHandler', () => {
  let mockRequest: Partial<NextRequest>;
  let consoleErrorSpy: jest.SpyInstance;
  const userId = 123;
  const validBody = {
    old_password: 'OldPass123',
    new_password: 'NewPass123'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock request object
    mockRequest = {
      json: jest.fn().mockResolvedValue(validBody),
    };

    // Default mock implementations
    (extractTokenFromRequest as jest.Mock).mockReturnValue('valid-token');
    (passwordLimiter.check as jest.Mock).mockResolvedValue({ success: true });
    (changePassword as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('应该在没有访问令牌时返回错误', async () => {
    (extractTokenFromRequest as jest.Mock).mockReturnValue(null);

    const response = await patchHandler(mockRequest as NextRequest, userId);

    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        message: 'auth.errors.invalidToken',
        code: ErrorCodes.INVALID_TOKEN
      },
      init: { status: 401 }
    });
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('应该在超出速率限制时返回错误', async () => {
    (passwordLimiter.check as jest.Mock).mockResolvedValue({ success: false });

    const response = await patchHandler(mockRequest as NextRequest, userId);

    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        message: 'auth.errors.rateLimitExceeded',
        code: ErrorCodes.RATE_LIMIT_EXCEEDED
      },
      init: { status: 429 }
    });
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('应该在请求体解析失败时返回错误', async () => {
    (mockRequest.json as jest.Mock).mockRejectedValue(new Error('Invalid JSON'));

    const response = await patchHandler(mockRequest as NextRequest, userId);

    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        message: 'common.errors.internalServerError',
        code: ErrorCodes.INTERNAL_SERVER_ERROR
      },
      init: { status: 500 }
    });
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('应该在密码更新成功时返回成功响应', async () => {
    const response = await patchHandler(mockRequest as NextRequest, userId);

    expect(response).toEqual({
      body: {
        status: 'success',
        data: null,
        message: 'user.messages.passwordUpdated'
      },
      init: { status: 200 }
    });
    expect(changePassword).toHaveBeenCalledWith(userId, validBody);
  });

  it('应该处理并传递 APIError', async () => {
    const apiError = new APIError(400, ErrorCodes.INVALID_PASSWORD, 'Invalid password');
    (changePassword as jest.Mock).mockRejectedValue(apiError);

    const response = await patchHandler(mockRequest as NextRequest, userId);

    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        message: 'Invalid password',
        code: ErrorCodes.INVALID_PASSWORD
      },
      init: { status: 400 }
    });
  });

  it('应该处理未知错误', async () => {
    const unknownError = new Error('Unknown error');
    (changePassword as jest.Mock).mockRejectedValue(unknownError);

    // 临时修改环境变量
    const originalNodeEnv = process.env.NODE_ENV;

    const response = await patchHandler(mockRequest as NextRequest, userId);

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
});