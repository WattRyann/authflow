import { PrismaClient } from '@prisma/client';
import { validateEmail } from '@/utils/validation';
import { APIError } from '@/middleware/errorHandler';
import { sendPasswordResetEmail } from '@/utils/mailer';
import crypto from 'crypto';
import { forgotPassword } from '../passwordService';

// Mock dependencies
jest.mock('@/utils/validation');
jest.mock('@/utils/mailer');
jest.mock('crypto');
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true)
  })
}));

describe('forgotPassword', () => {
  let mockPrismaClient: jest.Mocked<PrismaClient>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // 修改 mock PrismaClient 的类型定义
    mockPrismaClient = {
      $transaction: jest.fn((callback) => {
        if (typeof callback === 'function') {
          return callback(mockPrismaClient);
        }
        return Promise.resolve(callback);
      }),
      users: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(null))
      },
      password_Resets: {
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(null)),
        create: jest.fn().mockImplementation(() => Promise.resolve(null))
      }
    } as unknown as jest.Mocked<PrismaClient>;

    // Mock crypto.randomBytes
    (crypto.randomBytes as jest.Mock).mockReturnValue({
      toString: jest.fn().mockReturnValue('mockedToken123')
    });

    // Mock validateEmail
    (validateEmail as jest.Mock).mockReturnValue(true);

    // Mock sendPasswordResetEmail
    (sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const validEmail = 'test@example.com';

  it('邮箱格式无效时应抛出 APIError', async () => {
    (validateEmail as jest.Mock).mockReturnValue(false);

    await expect(forgotPassword({ email: 'invalid-email' }, mockPrismaClient))
      .rejects
      .toThrow(APIError);

    expect(validateEmail).toHaveBeenCalledWith('invalid-email');
    expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
  });

  it('用户不存在时不应该暴露信息', async () => {
    (mockPrismaClient.users.findUnique as jest.Mock).mockImplementation(() => Promise.resolve(null));

    await forgotPassword({ email: validEmail }, mockPrismaClient);

    expect(mockPrismaClient.users.findUnique).toHaveBeenCalledWith({
      where: { email: validEmail }
    });
    expect(mockPrismaClient.password_Resets.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('存在有效的重置请求时应复用现有token', async () => {
    const mockUser = { id: 1, email: validEmail };
    const mockExistingRequest = {
      token: 'existingToken123',
      expires_at: new Date(Date.now() + 3600000)
    };

    (mockPrismaClient.users.findUnique as jest.Mock).mockImplementation(() => Promise.resolve(mockUser));
    (mockPrismaClient.password_Resets.findFirst as jest.Mock).mockImplementation(() => Promise.resolve(mockExistingRequest));

    await forgotPassword({ email: validEmail }, mockPrismaClient);

    expect(mockPrismaClient.password_Resets.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(validEmail, mockExistingRequest.token);
  });

  it('不存在有效请求时应创建新的重置token', async () => {
    const mockUser = { id: 1, email: validEmail };
    const mockToken = 'mockedToken123';

    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockPrismaClient.password_Resets.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrismaClient.password_Resets.create as jest.Mock).mockResolvedValue({ token: mockToken });

    await forgotPassword({ email: validEmail }, mockPrismaClient);

    expect(crypto.randomBytes).toHaveBeenCalled();
    expect(mockPrismaClient.password_Resets.create).toHaveBeenCalledWith({
      data: {
        user_id: mockUser.id,
        token: mockToken,
        expires_at: expect.any(Date),
        is_used: false
      }
    });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(validEmail, mockToken);
  });

  it('数据库操作失败时应抛出 APIError', async () => {
    mockPrismaClient.$transaction.mockRejectedValue(new Error('Database error'));

    await expect(forgotPassword({ email: validEmail }, mockPrismaClient))
      .rejects
      .toThrow(APIError);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Password reset error:',
      expect.any(Error)
    );
  });

  it('发送邮件失败时应抛出 APIError', async () => {
    const mockUser = { id: 1, email: validEmail };
    
    (mockPrismaClient.users.findUnique as jest.Mock).mockImplementation(() => Promise.resolve(mockUser));
    (mockPrismaClient.password_Resets.findFirst as jest.Mock).mockImplementation(() => Promise.resolve(null));
    (sendPasswordResetEmail as jest.Mock).mockRejectedValue(new Error('Email sending failed'));

    await expect(forgotPassword({ email: validEmail }, mockPrismaClient))
      .rejects
      .toThrow(APIError);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Password reset error:',
      expect.any(Error)
    );
  });
});