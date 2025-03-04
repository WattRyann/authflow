// resetPassword.test.ts
import { resetPassword } from '../passwordService'; 
import { APIError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../types/api';
import { hashPassword } from '../../utils/bcrypt';
import { validatePassword } from '../../utils/validation';
import { PrismaClient } from '@prisma/client';

// 添加事务类型定义
interface ResetTx {
  password_Resets: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  users: {
    update: jest.Mock;
  };
  blacklisted_Tokens: {
    createMany: jest.Mock;
  };
}

jest.mock('../../utils/bcrypt', () => ({
  hashPassword: jest.fn()
}));
jest.mock('../../utils/validation', () => ({
  validatePassword: jest.fn()
}));
jest.mock('../../i18n', () => ({
  t: jest.fn((key) => key)
}));

describe('resetPassword', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let tx: ResetTx;

  const validToken = 'valid-token';
  const validNewPassword = 'ValidPass123';
  const hashedPassword = 'hashedValidPass123';

  // 模拟一个有效的重置请求记录
  const resetRequest = {
    id: 1,
    token: validToken,
    is_used: false,
    expires_at: new Date(Date.now() + 10000), // 未来的时间
    user_id: 123,
    user: { id: 123, email: 'user@example.com' }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // 构造事务中的 mock 对象
    tx = {
      password_Resets: {
        findFirst: jest.fn(),
        update: jest.fn()
      },
      users: {
        update: jest.fn()
      },
      blacklisted_Tokens: {
        createMany: jest.fn()
      }
    };

    // 构造模拟的 PrismaClient，并将 $transaction 方法模拟为调用回调并传入 tx 对象
    mockPrisma = {
      $transaction: jest.fn((callback: (tx: ResetTx) => Promise<unknown>) => callback(tx)),
      $on: jest.fn(),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $use: jest.fn(),
      // 添加其他必要的 PrismaClient 方法
    } as unknown as jest.Mocked<PrismaClient>;

    // 默认情况下，新密码验证通过
    (validatePassword as jest.Mock).mockReturnValue(true);
    // 模拟 hashPassword 返回哈希后的密码
    (hashPassword as jest.Mock).mockResolvedValue(hashedPassword);
  });

  it('should throw APIError for invalid new password', async () => {
    // 当密码格式不符合要求时，validatePassword 返回 false
    (validatePassword as jest.Mock).mockReturnValue(false);

    await expect(resetPassword(validToken, validNewPassword, mockPrisma))
      .rejects.toThrow(APIError);
    await expect(resetPassword(validToken, validNewPassword, mockPrisma))
      .rejects.toMatchObject({
        statusCode: 400,
        code: ErrorCodes.INVALID_PASSWORD
      });
  });

  it('should throw APIError when reset token is invalid or expired', async () => {
    // 模拟查询不到符合条件的重置记录
    tx.password_Resets.findFirst.mockResolvedValue(null);

    await expect(resetPassword(validToken, validNewPassword, mockPrisma))
      .rejects.toThrow(APIError);
    await expect(resetPassword(validToken, validNewPassword, mockPrisma))
      .rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCodes.INVALID_RESET_TOKEN
      });
  });

  it('should successfully reset the password', async () => {
    // 模拟查询到有效的重置记录
    tx.password_Resets.findFirst.mockResolvedValue(resetRequest);
    // 模拟用户密码更新、令牌更新、以及创建黑名单记录均成功
    tx.users.update.mockResolvedValue({});
    tx.password_Resets.update.mockResolvedValue({});
    tx.blacklisted_Tokens.createMany.mockResolvedValue({});

    await expect(resetPassword(validToken, validNewPassword, mockPrisma))
      .resolves.toBeUndefined();

    // 验证 hashPassword 被调用，新密码被转换为哈希密码
    expect(hashPassword).toHaveBeenCalledWith(validNewPassword);

    // 验证用户密码更新操作
    expect(tx.users.update).toHaveBeenCalledWith({
      where: { id: resetRequest.user_id },
      data: expect.objectContaining({
        password_hash: hashedPassword
      })
    });

    // 验证重置令牌被标记为已使用
    expect(tx.password_Resets.update).toHaveBeenCalledWith({
      where: { id: resetRequest.id },
      data: { is_used: true }
    });

    // 验证黑名单记录被创建（应创建 2 条记录：access 和 refresh）
    expect(tx.blacklisted_Tokens.createMany).toHaveBeenCalled();
    const createManyData = tx.blacklisted_Tokens.createMany.mock.calls[0][0].data;
    expect(createManyData.length).toBe(2);
    expect(createManyData[0].token_type).toBe('access');
    expect(createManyData[1].token_type).toBe('refresh');
  });

  it('should throw internal server error if unknown error occurs', async () => {
    const errorMessage = 'Unexpected error';
    // 模拟事务执行过程中抛出非 APIError 异常
    mockPrisma.$transaction.mockRejectedValue(new Error(errorMessage));

    // 使用 spy 捕获 console.error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(resetPassword(validToken, validNewPassword, mockPrisma))
      .rejects.toThrow(APIError);
    await expect(resetPassword(validToken, validNewPassword, mockPrisma))
      .rejects.toMatchObject({
        statusCode: 500,
        code: ErrorCodes.INTERNAL_SERVER_ERROR
      });

    expect(consoleSpy).toHaveBeenCalledWith('Password reset error:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
