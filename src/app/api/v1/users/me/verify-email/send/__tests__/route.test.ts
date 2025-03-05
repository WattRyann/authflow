import { NextRequest } from 'next/server';
import { ErrorCodes } from '@/types/api';
import { APIError } from '@/middleware/errorHandler';
import { extractTokenFromRequest } from '@/middleware/authMiddleware';
import { getUserEmailStatus, generateEmailVerificationToken } from '@/services/userService';
import { sendVerificationEmail } from '@/utils/mailer';
import { emailVerificationLimiter } from '@/middleware/rateLimit';

// 导入被测试的函数，但不导入 jsonError 和 jsonSuccess
import { POST } from '../route';

// 模拟依赖
jest.mock('@/middleware/authMiddleware', () => ({
  ...jest.requireActual('@/middleware/authMiddleware'),
  extractTokenFromRequest: jest.fn(),
  withAuth: jest.fn(handler => async (req: NextRequest) => {
    // 正确调用 extractTokenFromRequest 函数
    const token = extractTokenFromRequest(req);
    
    // 如果 extractTokenFromRequest 返回 null，模拟认证失败
    if (!token) {
      return {
        status: 'error',
        data: null,
        code: ErrorCodes.INVALID_TOKEN,
        message: 'auth.errors.invalidToken'
      };
    }
    
    // 否则调用处理函数
    return handler(req, 123);
  }),
}));

jest.mock('@/middleware/rateLimit', () => ({
  ...jest.requireActual('@/middleware/rateLimit'),
  emailVerificationLimiter: {
    check: jest.fn(),
  },
}));

jest.mock('@/services/userService', () => ({
  ...jest.requireActual('@/services/userService'),
  getUserEmailStatus: jest.fn(),
  generateEmailVerificationToken: jest.fn(),
}));

jest.mock('@/utils/mailer', () => ({
  ...jest.requireActual('@/utils/mailer'),
  sendVerificationEmail: jest.fn(),
}));

jest.mock('@/i18n', () => ({
  t: jest.fn((key) => key),
}));

// 修改 NextResponse 的模拟
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data) => data)  // 直接返回传入的数据对象
  }
}));

describe('postHandler', () => {
  let mockRequest: NextRequest;
  const userId = 123;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 创建模拟请求
    mockRequest = {
      headers: new Headers(),
      cookies: { get: jest.fn() },
    } as unknown as NextRequest;
    
    // 默认模拟返回值
    (extractTokenFromRequest as jest.Mock).mockReturnValue('valid-token');
    (emailVerificationLimiter.check as jest.Mock).mockResolvedValue({ success: true });
    (getUserEmailStatus as jest.Mock).mockResolvedValue({ isVerified: false });
    (generateEmailVerificationToken as jest.Mock).mockResolvedValue({ 
      email: 'test@example.com', 
      token: 'verification-token' 
    });
    (sendVerificationEmail as jest.Mock).mockResolvedValue(undefined);
  });

  it('应该成功发送验证邮件并返回成功响应', async () => {
    const response = await POST(mockRequest as NextRequest);
    
    // 验证依赖函数调用
    expect(extractTokenFromRequest).toHaveBeenCalledWith(mockRequest);
    expect(emailVerificationLimiter.check).toHaveBeenCalledWith(mockRequest, userId.toString());
    expect(getUserEmailStatus).toHaveBeenCalledWith(userId);
    expect(generateEmailVerificationToken).toHaveBeenCalledWith(userId);
    expect(sendVerificationEmail).toHaveBeenCalledWith('test@example.com', 'verification-token');
    
    // 验证响应内容
    expect(response).toEqual({
      status: 'success',
      data: null,
      message: 'user.messages.verificationEmailSent'
    });
  });

  it('当超出速率限制时应返回错误', async () => {
    (emailVerificationLimiter.check as jest.Mock).mockResolvedValue({ success: false });
    
    const response = await POST(mockRequest as NextRequest);
    
    expect(response).toEqual({
      status: 'error',
      data: null,
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message: 'auth.errors.rateLimitExceeded'
    });
    
    // 验证后续函数未被调用
    expect(getUserEmailStatus).not.toHaveBeenCalled();
  });

  it('当邮箱已验证时应返回错误', async () => {
    (getUserEmailStatus as jest.Mock).mockResolvedValue({ isVerified: true });
    
    const response = await POST(mockRequest as NextRequest);
    
    expect(response).toEqual({
      status: 'error',
      data: null,
      code: ErrorCodes.EMAIL_ALREADY_VERIFIED,
      message: 'user.errors.emailAlreadyVerified'
    });
    
    // 验证后续函数未被调用
    expect(generateEmailVerificationToken).not.toHaveBeenCalled();
  });

  it('当生成令牌时抛出 APIError 应正确处理', async () => {
    const apiError = new APIError(404, ErrorCodes.USER_NOT_FOUND, 'user.errors.userNotFound');
    (generateEmailVerificationToken as jest.Mock).mockRejectedValue(apiError);
    
    const response = await POST(mockRequest as NextRequest);
    
    expect(response).toEqual({
      status: 'error',
      data: null,
      code: ErrorCodes.USER_NOT_FOUND,
      message: 'user.errors.userNotFound'
    });
  });

  it('当发生未知错误时应返回内部服务器错误', async () => {
    const unknownError = new Error('未知错误');
    (generateEmailVerificationToken as jest.Mock).mockRejectedValue(unknownError);

    const response = await POST(mockRequest as NextRequest);
    
    expect(response).toEqual({
      status: 'error',
      data: null,
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: 'common.errors.internalServerError'
    });
  });
});