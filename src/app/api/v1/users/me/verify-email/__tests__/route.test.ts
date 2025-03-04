import { NextRequest } from 'next/server';
import { ErrorCodes } from '@/types/api';
import { APIError } from '@/middleware/errorHandler';
import { extractTokenFromRequest } from '@/middleware/authMiddleware';
import { verifyEmail } from '@/services/emailVerificationService';

// 导入被测试的函数
import { patchHandler } from '../route';

// 模拟依赖
jest.mock('@/middleware/authMiddleware', () => ({
  extractTokenFromRequest: jest.fn(),
  withAuth: jest.fn(handler => handler),
}));

jest.mock('@/services/emailVerificationService', () => ({
  verifyEmail: jest.fn(),
}));

jest.mock('@/i18n', () => ({
  t: jest.fn((key) => key),
}));

// 修改 NextResponse 的模拟
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((body, init) => ({ body, init }))
  }
}));

describe('patchHandler', () => {
  let mockRequest: Partial<NextRequest>;
  const userId = 123;
  const validCode = '123456';
  const mockVerificationResult = { isVerified: true };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 创建模拟请求
    mockRequest = {
      json: jest.fn().mockResolvedValue({ code: validCode }),
    };
    
    // 默认模拟返回值
    (extractTokenFromRequest as jest.Mock).mockReturnValue('valid-token');
    (verifyEmail as jest.Mock).mockResolvedValue(mockVerificationResult);
  });

  it('应该成功验证邮箱并返回成功响应', async () => {
    const response = await patchHandler(mockRequest as NextRequest, userId);
    
    // 验证依赖函数调用
    expect(extractTokenFromRequest).toHaveBeenCalledWith(mockRequest);
    expect(verifyEmail).toHaveBeenCalledWith(userId, { code: validCode });
    
    // 验证响应内容
    expect(response).toEqual({
      body: {
        status: 'success',
        data: mockVerificationResult,
        message: 'user.messages.emailVerifiedSuccess'
      },
      init: { status: 200 }
    });
  });

  it('当访问令牌无效时应返回错误', async () => {
    (extractTokenFromRequest as jest.Mock).mockReturnValue(null);
    
    const response = await patchHandler(mockRequest as NextRequest, userId);
    
    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        code: ErrorCodes.INVALID_TOKEN,
        message: 'auth.errors.invalidToken'
      },
      init: { status: 401 }
    });
    
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it('当请求体解析失败时应返回错误', async () => {
    (mockRequest.json as jest.Mock).mockRejectedValue(new Error('Invalid JSON'));
    
    const response = await patchHandler(mockRequest as NextRequest, userId);
    
    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'common.errors.internalServerError'
      },
      init: { status: 500 }
    });
    
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it('当验证邮箱时抛出 APIError 应正确处理', async () => {
    const apiError = new APIError(400, ErrorCodes.INVALID_VERIFICATION_CODE, 'user.errors.invalidVerificationCode');
    (verifyEmail as jest.Mock).mockRejectedValue(apiError);
    
    const response = await patchHandler(mockRequest as NextRequest, userId);
    
    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        code: ErrorCodes.INVALID_VERIFICATION_CODE,
        message: 'user.errors.invalidVerificationCode'
      },
      init: { status: 400 }
    });
  });

  it('当验证码过期时应返回相应错误', async () => {
    const apiError = new APIError(400, ErrorCodes.VERIFICATION_CODE_EXPIRED, 'user.errors.verificationCodeExpired');
    (verifyEmail as jest.Mock).mockRejectedValue(apiError);
    
    const response = await patchHandler(mockRequest as NextRequest, userId);
    
    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        code: ErrorCodes.VERIFICATION_CODE_EXPIRED,
        message: 'user.errors.verificationCodeExpired'
      },
      init: { status: 400 }
    });
  });

  it('当发生未知错误时应返回内部服务器错误', async () => {
    const unknownError = new Error('未知错误');
    (verifyEmail as jest.Mock).mockRejectedValue(unknownError);

    const response = await patchHandler(mockRequest as NextRequest, userId);
    
    expect(response).toEqual({
      body: {
        status: 'error',
        data: null,
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'common.errors.internalServerError'
      },
      init: { status: 500 }
    });
  });

  it('在测试环境中不应记录错误', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    const unknownError = new Error('测试错误');
    (verifyEmail as jest.Mock).mockRejectedValue(unknownError);

    await patchHandler(mockRequest as NextRequest, userId);
    
    expect(consoleSpy).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});