import { PrismaClient } from '@prisma/client';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes, UserInfo } from '@/types/api';
import i18n from '@/i18n';
import { getCurrentUserInfo } from '@/services/userService';

// 模拟依赖
jest.mock('@/i18n', () => ({
  t: jest.fn((key) => `translated.${key}`)
}));

describe('getCurrentUserInfo', () => {
  let mockPrismaClient: jest.Mocked<PrismaClient>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // 创建模拟的 PrismaClient
    mockPrismaClient = {
      users: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(null))
      }
    } as unknown as jest.Mocked<PrismaClient>;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('应成功获取用户信息', async () => {
    // 准备模拟数据
    const userId = 1;
    const mockUser = {
      id: userId,
      username: 'testuser',
      email: 'test@example.com',
      email_verified: true,
      twoFactorSettings: {
        is_enabled: true
      },
      roles: [
        {
          role: {
            name: 'user'
          }
        },
        {
          role: {
            name: 'admin'
          }
        }
      ]
    };

    // 设置模拟返回值
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue(mockUser);

    // 执行测试
    const result = await getCurrentUserInfo(userId, mockPrismaClient);

    // 验证结果
    expect(mockPrismaClient.users.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
      include: {
        twoFactorSettings: true,
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    expect(result).toEqual({
      username: 'testuser',
      email: 'test@example.com',
      roles: ['user', 'admin'],
      is_email_verified: true,
      two_factor_enabled: true
    });
  });

  it('应处理用户名为空的情况', async () => {
    // 准备模拟数据
    const userId = 1;
    const mockUser = {
      id: userId,
      username: null,
      email: 'test@example.com',
      email_verified: true,
      twoFactorSettings: null,
      roles: []
    };

    // 设置模拟返回值
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue(mockUser);

    // 执行测试
    const result = await getCurrentUserInfo(userId, mockPrismaClient);

    // 验证结果
    expect(result).toEqual({
      username: '',
      email: 'test@example.com',
      roles: [],
      is_email_verified: true,
      two_factor_enabled: false
    });
  });

  it('用户不存在时应抛出 USER_NOT_FOUND 错误', async () => {
    // 准备模拟数据
    const userId = 999;
    
    // 设置模拟返回值
    (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue(null);

    // 执行测试并验证结果
    await expect(getCurrentUserInfo(userId, mockPrismaClient))
      .rejects
      .toThrow(APIError);

    expect(i18n.t).toHaveBeenCalledWith('user.errors.userNotFound');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('数据库查询失败时应抛出 INTERNAL_SERVER_ERROR', async () => {
    // 准备模拟数据
    const userId = 1;
    const dbError = new Error('Database connection failed');
    
    // 设置模拟返回值
    (mockPrismaClient.users.findUnique as jest.Mock).mockRejectedValue(dbError);

    // 执行测试并验证结果
    await expect(getCurrentUserInfo(userId, mockPrismaClient))
      .rejects
      .toThrow(APIError);

    expect(consoleErrorSpy).toHaveBeenCalledWith('获取用户信息错误:', dbError);
    expect(i18n.t).toHaveBeenCalledWith('common.errors.internalServerError');
  });

  it('应重新抛出 APIError 类型的错误', async () => {
    // 准备模拟数据
    const userId = 1;
    const apiError = new APIError(403, ErrorCodes.UNAUTHORIZED, 'Custom API error');
    
    // 设置模拟返回值
    (mockPrismaClient.users.findUnique as jest.Mock).mockRejectedValue(apiError);

    // 执行测试并验证结果
    await expect(getCurrentUserInfo(userId, mockPrismaClient))
      .rejects
      .toThrow(apiError);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});