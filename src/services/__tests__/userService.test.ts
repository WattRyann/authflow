import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/utils/bcrypt';
import { validateUsername, validateEmail, validatePassword } from '@/utils/validation';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/types/api';
import { sendVerificationEmail } from '@/utils/mailer';
import { register, getUserEmailStatus, generateEmailVerificationToken } from '@/services/userService';
import crypto from 'crypto';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('@/utils/bcrypt');
jest.mock('@/utils/validation');
jest.mock('@/utils/mailer');
jest.mock('crypto');
jest.mock('@/i18n', () => ({
  t: jest.fn((key) => key)
}));
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'mock-message-id'
    })
  })
}));

describe('register', () => {
  let mockPrismaClient: jest.Mocked<PrismaClient>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(crypto, 'randomBytes').mockImplementation((size: number) => {
      return Buffer.from('mockToken123');
    });
    // 创建 mock PrismaClient
    mockPrismaClient = {
      $transaction: jest.fn((callback) => {
        if (typeof callback === 'function') {
          return callback(mockPrismaClient);
        }
        return Promise.resolve(callback);
      }),
      users: {
        findUnique: jest.fn().mockResolvedValue(null) as jest.Mock,
        create: jest.fn().mockResolvedValue(null) as jest.Mock
      },
      email_Verifications: {
        create: jest.fn() as jest.Mock
      }
    } as unknown as jest.Mocked<PrismaClient>;

    // 模拟 PrismaClient 构造函数返回我们的 mock 对象
    (PrismaClient as jest.Mock).mockImplementation(() => mockPrismaClient);

    mockPrismaClient.$transaction = jest
    .fn()
    .mockImplementation(async (transactionCallback) => {
      // 让 transactionCallback 拿到的 tx 就是 mockPrismaClient 自己
      return transactionCallback(mockPrismaClient);
    });
    
    mockPrismaClient.users.findUnique = jest.fn();
    mockPrismaClient.users.create = jest.fn();
    mockPrismaClient.email_Verifications.create = jest.fn();

    // 模拟验证函数返回 true
    (validateUsername as jest.Mock).mockReturnValue(true);
    (validateEmail as jest.Mock).mockReturnValue(true);
    (validatePassword as jest.Mock).mockReturnValue(true);

    // 模拟 hashPassword 返回已哈希的密码
    (hashPassword as jest.Mock).mockResolvedValue('hashedPassword123');

    // 模拟发送验证邮件成功
    (sendVerificationEmail as jest.Mock).mockResolvedValue(undefined);
  });

  const validParams = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Password123'
  };

  it('should successfully register a new user', async () => {
    // 创建一个更完整的模拟用户对象
    const mockUser = {
      id: 1,
      username: validParams.username,
      email: validParams.email,
      password_hash: 'hashedPassword123',
      is_active: false,
      email_verified: false
    };

    const mockVerificationToken = {
      token: 'mockToken123'
    };

    // 修改 findUnique 的模拟实现，确保它能正确处理两次调用
    const findUniqueMock = jest.fn()
      .mockResolvedValueOnce(null)  // 第一次调用：用户名检查返回 null
      .mockResolvedValueOnce(null); // 第二次调用：邮箱检查返回 null
    
    mockPrismaClient.users.findUnique = findUniqueMock;
    (mockPrismaClient.users.create as jest.Mock).mockResolvedValue(mockUser);
    (mockPrismaClient.email_Verifications.create as jest.Mock).mockResolvedValue(mockVerificationToken);

    const result = await register(validParams, mockPrismaClient);

    // 验证结果
    expect(result).toEqual({
      user_id: '1',
      username: validParams.username,
      email: validParams.email
    });

    // 验证发送邮件调用
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      validParams.email,
      mockVerificationToken.token
    );
  });

  // 修改其他测试用例，添加 mockPrismaClient 参数
  it('should throw APIError when username is invalid', async () => {
    (validateUsername as jest.Mock).mockReturnValue(false);
    const error = await register(validParams, mockPrismaClient).catch(e => e);
    expect(error).toBeInstanceOf(APIError);
    expect(error).toMatchObject({
      statusCode: 400,
      code: ErrorCodes.INVALID_USERNAME
    });
  });

  it('should throw APIError when email is invalid', async () => {
    (validateEmail as jest.Mock).mockReturnValue(false);
    const error = await register(validParams, mockPrismaClient).catch(e => e);
    expect(error).toBeInstanceOf(APIError);
    expect(error).toMatchObject({
      statusCode: 400,
      code: ErrorCodes.INVALID_EMAIL
    });
  });

  it('should throw APIError when password is invalid', async () => {
    (validatePassword as jest.Mock).mockReturnValue(false);
    const error = await register(validParams, mockPrismaClient).catch(e => e);
    expect(error).toBeInstanceOf(APIError);
    expect(error).toMatchObject({
      statusCode: 400,
      code: ErrorCodes.INVALID_PASSWORD
    });
  });

  it('should throw APIError when username already exists', async () => {
    const findUniqueMock = jest.fn()
      .mockResolvedValueOnce({ id: 2 })  // username check
      .mockResolvedValueOnce(null);      // email check
    
    mockPrismaClient.users.findUnique = findUniqueMock;

    const error = await register(validParams, mockPrismaClient).catch(e => e);
    expect(error).toBeInstanceOf(APIError);
    expect(error).toMatchObject({
      statusCode: 400,
      code: ErrorCodes.REG_USERNAME_EXISTS
    });
  });

  it('should throw APIError when email already exists', async () => {
    const findUniqueMock = jest.fn()
      .mockResolvedValueOnce(null)       // username check
      .mockResolvedValueOnce({ id: 2 }); // email check
    
    mockPrismaClient.users.findUnique = findUniqueMock;

    const error = await register(validParams, mockPrismaClient).catch(e => e);
    expect(error).toBeInstanceOf(APIError);
    expect(error).toMatchObject({
      statusCode: 400,
      code: ErrorCodes.REG_EMAIL_EXISTS
    });
  });

  it('should throw APIError when database operation fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockPrismaClient.$transaction.mockRejectedValue(new Error('Database error'));
    
    const error = await register(validParams, mockPrismaClient).catch(e => e);
    
    expect(error).toBeInstanceOf(APIError);
    expect(error).toMatchObject({
      statusCode: 500,
      code: ErrorCodes.INTERNAL_SERVER_ERROR
    });
    
    consoleErrorSpy.mockRestore();
  });

  it('should throw APIError when email sending fails', async () => {
    const mockUser = {
      id: 1,
      username: validParams.username,
      email: validParams.email
    };

    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrismaClient.users.create as jest.Mock).mockResolvedValue(mockUser);
    (mockPrismaClient.email_Verifications.create as jest.Mock).mockResolvedValue({ token: 'mockToken123' });
    
    (sendVerificationEmail as jest.Mock).mockRejectedValue(new Error('Email sending failed'));

    const error = await register(validParams, mockPrismaClient).catch(e => e);
    expect(error).toBeInstanceOf(APIError);
    expect(error).toMatchObject({
      statusCode: 500,
      code: ErrorCodes.INTERNAL_SERVER_ERROR
    });
  });
});

// Mock dependencies
jest.mock('@/i18n', () => ({
  t: jest.fn((key) => key)
}));

describe('getUserEmailStatus', () => {
  let mockPrismaClient: jest.Mocked<PrismaClient>;
  const mockUserId = 123;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 创建 mock PrismaClient
    mockPrismaClient = {
      users: {
        findUnique: jest.fn()
      }
    } as unknown as jest.Mocked<PrismaClient>;
  });

  it('应该返回用户的邮箱验证状态为已验证', async () => {
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue({
      email_verified: true
    });

    const result = await getUserEmailStatus(mockUserId, mockPrismaClient);

    expect(mockPrismaClient.users.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserId },
      select: { email_verified: true }
    });
    expect(result).toEqual({ isVerified: true });
  });

  it('应该返回用户的邮箱验证状态为未验证', async () => {
    // Mock Prisma 返回未验证的用户
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue({
      email_verified: false
    });

    const result = await getUserEmailStatus(mockUserId, mockPrismaClient as PrismaClient);

    expect(mockPrismaClient.users.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserId },
      select: { email_verified: true }
    });
    expect(result).toEqual({ isVerified: false });
  });

  it('当用户不存在时应该抛出 APIError', async () => {
    // Mock Prisma 返回 null（用户不存在）
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getUserEmailStatus(mockUserId, mockPrismaClient as PrismaClient))
      .rejects.toThrow(
        new APIError(404, ErrorCodes.USER_NOT_FOUND, 'user.errors.userNotFound')
      );

    expect(mockPrismaClient.users.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserId },
      select: { email_verified: true }
    });
  });

  it('当数据库查询失败时应该抛出内部服务器错误', async () => {
    // Mock Prisma 抛出数据库错误
    const dbError = new Error('Database connection failed');
    (mockPrismaClient.users.findUnique as jest.Mock).mockRejectedValue(dbError);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getUserEmailStatus(mockUserId, mockPrismaClient as PrismaClient))
      .rejects.toThrow(
        new APIError(
          500,
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'common.errors.internalServerError'
        )
      );

    expect(consoleSpy).toHaveBeenCalledWith('获取用户邮箱状态错误:', dbError);
    expect(mockPrismaClient.users.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserId },
      select: { email_verified: true }
    });

    consoleSpy.mockRestore();
  });
});

describe('generateEmailVerificationToken', () => {
  let mockPrismaClient: jest.Mocked<PrismaClient>;
  let consoleErrorSpy: jest.SpyInstance;
  const mockUserId = 123;
  const mockEmail = 'test@example.com';
  const mockToken = 'mock-token-123';
  const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock crypto.randomBytes
    (crypto.randomBytes as jest.Mock).mockReturnValue({
      toString: jest.fn().mockReturnValue(mockToken)
    });

    // 创建 mock PrismaClient
    mockPrismaClient = {
      users: {
        findUnique: jest.fn()
      },
      email_Verifications: {
        create: jest.fn()
      }
    } as unknown as jest.Mocked<PrismaClient>;

    // Mock Date.now()
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('应该成功生成并保存验证令牌', async () => {
    // Mock user lookup
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue({
      email: mockEmail
    });

    // Mock token creation
    (mockPrismaClient.email_Verifications.create as jest.Mock).mockResolvedValue({
      token: mockToken
    });

    const result = await generateEmailVerificationToken(mockUserId, mockPrismaClient);

    // 验证用户查询
    expect(mockPrismaClient.users.findUnique).toHaveBeenCalledWith({
      where: { id: mockUserId },
      select: { email: true }
    });

    // 验证令牌创建
    expect(mockPrismaClient.email_Verifications.create).toHaveBeenCalledWith({
      data: {
        user_id: mockUserId,
        token: mockToken,
        expires_at: new Date(1000 + TOKEN_EXPIRY_MS)
      }
    });

    // 验证返回结果
    expect(result).toEqual({
      email: mockEmail,
      token: mockToken
    });
  });

  it('当用户不存在时应该抛出 APIError', async () => {
    // Mock user lookup returns null
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(generateEmailVerificationToken(mockUserId, mockPrismaClient))
      .rejects.toThrow(
        new APIError(404, ErrorCodes.USER_NOT_FOUND, 'user.errors.userNotFound')
      );

    expect(mockPrismaClient.email_Verifications.create).not.toHaveBeenCalled();
  });

  it('当数据库查询失败时应该抛出内部服务器错误', async () => {
    const dbError = new Error('Database connection failed');
    (mockPrismaClient.users.findUnique as jest.Mock).mockRejectedValue(dbError);

    await expect(generateEmailVerificationToken(mockUserId, mockPrismaClient))
      .rejects.toThrow(
        new APIError(
          500,
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'common.errors.internalServerError'
        )
      );

    expect(consoleErrorSpy).toHaveBeenCalledWith('生成邮箱验证令牌错误:', dbError);
  });

  it('当令牌创建失败时应该抛出内部服务器错误', async () => {
    // Mock successful user lookup
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue({
      email: mockEmail
    });

    // Mock token creation failure
    const dbError = new Error('Token creation failed');
    (mockPrismaClient.email_Verifications.create as jest.Mock).mockRejectedValue(dbError);

    await expect(generateEmailVerificationToken(mockUserId, mockPrismaClient))
      .rejects.toThrow(
        new APIError(
          500,
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'common.errors.internalServerError'
        )
      );

    expect(consoleErrorSpy).toHaveBeenCalledWith('生成邮箱验证令牌错误:', dbError);
  });
});