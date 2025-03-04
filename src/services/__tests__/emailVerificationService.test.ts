import { PrismaClient } from '@prisma/client';
import { verifyEmail } from '@/services/emailVerificationService';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/types/api';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('@/i18n', () => ({
  t: jest.fn((key) => key)
}));

describe('verifyEmail', () => {
  let mockPrismaClient: jest.Mocked<PrismaClient>;
  let consoleErrorSpy: jest.SpyInstance;
  
  const validUserId = 123;
  const validCode = '123456';
  
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // 创建 mock PrismaClient
    const tx = {
      users: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      email_Verifications: {
        findFirst: jest.fn(),
        update: jest.fn()
      }
    };
    
    mockPrismaClient = {
      $transaction: jest.fn((callback) => {
        if (typeof callback === 'function') {
          return callback(tx);
        }
        return Promise.resolve(callback);
      }),
      users: tx.users,
      email_Verifications: tx.email_Verifications
    } as unknown as jest.Mocked<PrismaClient>;
  });
  
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });
  
  it('应该在验证码格式无效时抛出错误', async () => {
    // 测试空验证码
    await expect(verifyEmail(validUserId, { code: '' }, mockPrismaClient))
      .rejects
      .toThrow(APIError);
      
    await expect(verifyEmail(validUserId, { code: '' }, mockPrismaClient))
      .rejects
      .toMatchObject({
        statusCode: 400,
        code: ErrorCodes.INVALID_CODE
      });
      
    // 测试长度不为6的验证码
    await expect(verifyEmail(validUserId, { code: '12345' }, mockPrismaClient))
      .rejects
      .toThrow(APIError);
      
    await expect(verifyEmail(validUserId, { code: '12345' }, mockPrismaClient))
      .rejects
      .toMatchObject({
        statusCode: 400,
        code: ErrorCodes.INVALID_CODE
      });
      
    // 验证事务未被调用
    expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
  });
  
  it('应该在邮箱已验证时抛出错误', async () => {
    // Mock 用户邮箱已验证
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue({
      email_verified: true
    });
    
    await expect(verifyEmail(validUserId, { code: validCode }, mockPrismaClient))
      .rejects
      .toThrow(APIError);
      
    await expect(verifyEmail(validUserId, { code: validCode }, mockPrismaClient))
      .rejects
      .toMatchObject({
        statusCode: 400,
        code: ErrorCodes.EMAIL_ALREADY_VERIFIED
      });
      
    expect(mockPrismaClient.users.findUnique).toHaveBeenCalledWith({
      where: { id: validUserId },
      select: { email_verified: true }
    });
    
    expect(mockPrismaClient.email_Verifications.findFirst).not.toHaveBeenCalled();
    expect(mockPrismaClient.email_Verifications.update).not.toHaveBeenCalled();
    expect(mockPrismaClient.users.update).not.toHaveBeenCalled();
  });
  
  it('应该在验证码无效或过期时抛出错误', async () => {
    // Mock 用户邮箱未验证
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue({
      email_verified: false
    });
    
    // Mock 找不到有效的验证码
    (mockPrismaClient.email_Verifications.findFirst as jest.Mock).mockResolvedValue(null);
    
    await expect(verifyEmail(validUserId, { code: validCode }, mockPrismaClient))
      .rejects
      .toThrow(APIError);
      
    await expect(verifyEmail(validUserId, { code: validCode }, mockPrismaClient))
      .rejects
      .toMatchObject({
        statusCode: 400,
        code: ErrorCodes.INVALID_CODE
      });
      
    expect(mockPrismaClient.users.findUnique).toHaveBeenCalledWith({
      where: { id: validUserId },
      select: { email_verified: true }
    });
    
    expect(mockPrismaClient.email_Verifications.findFirst).toHaveBeenCalledWith({
      where: {
        user_id: validUserId,
        token: validCode,
        is_used: false,
        expires_at: { gt: expect.any(Date) }
      }
    });
    
    expect(mockPrismaClient.email_Verifications.update).not.toHaveBeenCalled();
    expect(mockPrismaClient.users.update).not.toHaveBeenCalled();
  });
  
  it('应该成功验证邮箱', async () => {
    const mockVerification = {
      id: 1,
      user_id: validUserId,
      token: validCode,
      is_used: false,
      expires_at: new Date(Date.now() + 3600000)
    };
    
    // Mock 用户邮箱未验证
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue({
      email_verified: false
    });
    
    // Mock 找到有效的验证码
    (mockPrismaClient.email_Verifications.findFirst as jest.Mock).mockResolvedValue(mockVerification);
    
    // Mock 更新操作
    (mockPrismaClient.email_Verifications.update as jest.Mock).mockResolvedValue({});
    (mockPrismaClient.users.update as jest.Mock).mockResolvedValue({});
    
    const result = await verifyEmail(validUserId, { code: validCode }, mockPrismaClient);
    
    expect(result).toEqual({ is_email_verified: true });
    
    expect(mockPrismaClient.users.findUnique).toHaveBeenCalledWith({
      where: { id: validUserId },
      select: { email_verified: true }
    });
    
    expect(mockPrismaClient.email_Verifications.findFirst).toHaveBeenCalledWith({
      where: {
        user_id: validUserId,
        token: validCode,
        is_used: false,
        expires_at: { gt: expect.any(Date) }
      }
    });
    
    expect(mockPrismaClient.email_Verifications.update).toHaveBeenCalledWith({
      where: { id: mockVerification.id },
      data: { is_used: true }
    });
    
    expect(mockPrismaClient.users.update).toHaveBeenCalledWith({
      where: { id: validUserId },
      data: { email_verified: true }
    });
  });
  
  it('应该处理数据库错误', async () => {
    const dbError = new Error('Database connection failed');
    mockPrismaClient.$transaction.mockRejectedValue(dbError);
    
    await expect(verifyEmail(validUserId, { code: validCode }, mockPrismaClient))
      .rejects
      .toThrow(APIError);
      
    await expect(verifyEmail(validUserId, { code: validCode }, mockPrismaClient))
      .rejects
      .toMatchObject({
        statusCode: 500,
        code: ErrorCodes.INTERNAL_SERVER_ERROR
      });
      
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Email verification error:',
      dbError
    );
  });
  
  it('应该直接抛出 APIError 类型的错误', async () => {
    const apiError = new APIError(403, ErrorCodes.UNAUTHORIZED, 'Custom API error');
    mockPrismaClient.$transaction.mockRejectedValue(apiError);
    
    await expect(verifyEmail(validUserId, { code: validCode }, mockPrismaClient))
      .rejects
      .toThrow(apiError);
      
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});