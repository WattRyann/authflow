import { PrismaClient } from '@prisma/client';
import { changePassword } from '../userService';
import { validatePassword } from '@/utils/validation';
import { comparePassword, hashPassword } from '@/utils/bcrypt';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/types/api';

// Mock dependencies
jest.mock('@/utils/validation');
jest.mock('@/utils/bcrypt');
jest.mock('@/i18n', () => ({
  t: jest.fn((key) => key)
}));

describe('changePassword', () => {
  let mockPrismaClient: jest.Mocked<PrismaClient>;
  let consoleErrorSpy: jest.SpyInstance;
  let mockDate: Date;

  const validUserId = 123;
  const validRequest = {
    old_password: 'OldPass123',
    new_password: 'NewPass123'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDate = new Date('2024-01-01T00:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    // 创建 mock PrismaClient
    const tx = {
      users: {
        findUnique: jest.fn(),
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
      users: tx.users
    } as unknown as jest.Mocked<PrismaClient>;

    // 设置默认的 mock 返回值
    (validatePassword as jest.Mock).mockReturnValue(true);
    (comparePassword as jest.Mock).mockResolvedValue(true);
    (hashPassword as jest.Mock).mockResolvedValue('newHashedPassword');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('应该在新密码格式无效时抛出错误', async () => {
    (validatePassword as jest.Mock).mockReturnValue(false);

    await expect(changePassword(validUserId, validRequest, mockPrismaClient))
      .rejects
      .toThrow(APIError);

    await expect(changePassword(validUserId, validRequest, mockPrismaClient))
      .rejects
      .toMatchObject({
        statusCode: 400,
        code: ErrorCodes.INVALID_PASSWORD
      });

    expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
  });

  it('应该在用户不存在时抛出错误', async () => {
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(changePassword(validUserId, validRequest, mockPrismaClient))
      .rejects
      .toThrow(APIError);

    await expect(changePassword(validUserId, validRequest, mockPrismaClient))
      .rejects
      .toMatchObject({
        statusCode: 404,
        code: ErrorCodes.USER_NOT_FOUND
      });
  });

  it('应该在旧密码不正确时抛出错误', async () => {
    const mockUser = { password_hash: 'oldHashedPassword' };
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (comparePassword as jest.Mock).mockResolvedValue(false);

    await expect(changePassword(validUserId, validRequest, mockPrismaClient))
      .rejects
      .toThrow(APIError);

    await expect(changePassword(validUserId, validRequest, mockPrismaClient))
      .rejects
      .toMatchObject({
        statusCode: 401,
        code: ErrorCodes.INCORRECT_PASSWORD
      });
  });

  it('应该成功更新密码', async () => {
    const mockUser = { password_hash: 'oldHashedPassword' };
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (mockPrismaClient.users.update as jest.Mock).mockResolvedValue({});

    await expect(changePassword(validUserId, validRequest, mockPrismaClient))
      .resolves
      .toBeUndefined();

    expect(validatePassword).toHaveBeenCalledWith(validRequest.new_password);
    expect(comparePassword).toHaveBeenCalledWith(
      validRequest.old_password,
      mockUser.password_hash
    );
    expect(hashPassword).toHaveBeenCalledWith(validRequest.new_password);
    expect(mockPrismaClient.users.update).toHaveBeenCalledWith({
      where: { id: validUserId },
      data: {
        password_hash: 'newHashedPassword',
        password_changed_at: mockDate
      }
    });
  });

  it('应该处理数据库错误', async () => {
    const dbError = new Error('Database connection failed');
    mockPrismaClient.$transaction.mockRejectedValue(dbError);

    await expect(changePassword(validUserId, validRequest, mockPrismaClient))
      .rejects
      .toThrow(APIError);

    await expect(changePassword(validUserId, validRequest, mockPrismaClient))
      .rejects
      .toMatchObject({
        statusCode: 500,
        code: ErrorCodes.INTERNAL_SERVER_ERROR
      });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '修改密码错误:',
      dbError
    );
  });

  it('应该直接抛出 APIError 类型的错误', async () => {
    const apiError = new APIError(403, ErrorCodes.UNAUTHORIZED, 'Custom API error');
    mockPrismaClient.$transaction.mockRejectedValue(apiError);

    await expect(changePassword(validUserId, validRequest, mockPrismaClient))
      .rejects
      .toThrow(apiError);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});