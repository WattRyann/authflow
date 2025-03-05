// src/utils/__tests__/jwt.test.ts
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import ms from 'ms';

// 设置环境变量
process.env.JWT_ACCESS_SECRET = 'your-access-secret';
process.env.JWT_REFRESH_SECRET = 'your-refresh-secret';
process.env.JWT_ACCESS_EXPIRES = '1h';
process.env.JWT_REFRESH_EXPIRES = '7d';

// Mock dependencies first
jest.mock('jsonwebtoken');
jest.mock('uuid');
jest.mock('ms');

// 使用 jest.doMock 而不是 jest.mock
const mockPrismaCreate = jest.fn();

// 在 jest.mock 中使用函数返回模拟对象
jest.mock('@/lib/prisma', () => {
  // 在这里创建一个新的 mock 函数，而不是引用外部变量
  return {
    __esModule: true,
    default: {
      refresh_Tokens: {
        create: jest.fn().mockImplementation((...args) => {
          // 将调用转发到外部的 mockPrismaCreate
          return mockPrismaCreate(...args);
        })
      }
    }
  };
});

// 导入被测试的函数
import { generateTokens } from '@/utils/jwt';
import prisma from '@/lib/prisma';

// 创建一个模拟的 Prisma 客户端用于测试
const mockPrisma = prisma;

describe('generateTokens', () => {
  const mockUserId = BigInt(1);
  const mockJti = '123e4567-e89b-12d3-a456-426614174000';
  const mockAccessToken = 'mock.access.token';
  const mockRefreshToken = 'mock.refresh.token';
  const mockMsValue = 604800000; // 7天的毫秒数

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();

    // Mock uuid 返回固定 jti
    (uuidv4 as jest.Mock).mockReturnValue(mockJti);

    // Mock jwt.sign：根据调用顺序返回不同的 token
    let callCount = 0;
    (jwt.sign as jest.Mock).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockAccessToken : mockRefreshToken;
    });

    // Mock ms 返回固定毫秒值
    (ms as jest.Mock).mockReturnValue(mockMsValue);

    // 固定 Date.now() 返回一个确定的时间戳
    jest.spyOn(Date, 'now').mockImplementation(() => 1625097600000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('应该成功生成访问令牌和刷新令牌', async () => {
    const result = await generateTokens(mockUserId, mockPrisma);

    expect(result).toEqual({
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
    });

    // 验证 uuid 被调用一次
    expect(uuidv4).toHaveBeenCalledTimes(1);

    // 验证 jwt.sign 被调用了两次
    expect(jwt.sign).toHaveBeenCalledTimes(2);

    // 验证访问令牌的签名参数
    expect(jwt.sign).toHaveBeenCalledWith(
      { user_id: Number(mockUserId), jti: mockJti },
      expect.any(String),
      expect.objectContaining({
        expiresIn: process.env.JWT_ACCESS_EXPIRES,
        algorithm: 'HS256',
      })
    );

    // 验证刷新令牌的签名参数
    expect(jwt.sign).toHaveBeenCalledWith(
      { user_id: Number(mockUserId), jti: mockJti },
      expect.any(String),
      expect.objectContaining({
        expiresIn: process.env.JWT_REFRESH_EXPIRES,
        algorithm: 'HS256',
      })
    );

    // 验证刷新令牌存储到数据库的调用
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: {
        token: mockRefreshToken,
        user_id: Number(mockUserId),
        expires_at: new Date(1625097600000 + mockMsValue),
      },
    });
  });

  it('应该在数据库操作失败时抛出错误', async () => {
    const dbError = new Error('Database error');
    mockPrismaCreate.mockRejectedValueOnce(dbError);

    await expect(generateTokens(mockUserId, mockPrisma))
      .rejects
      .toThrow(dbError);
  });

  it('应该使用默认的 Prisma 实例当未提供实例时', async () => {
    await generateTokens(mockUserId);
    expect(jwt.sign).toHaveBeenCalledTimes(2);
  });

  it('应该正确处理大数值的用户ID', async () => {
    const largeUserId = BigInt('9007199254740991'); // JavaScript 最大安全整数
    
    await generateTokens(largeUserId, mockPrisma);

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: Number(largeUserId) }),
      expect.any(String),
      expect.any(Object)
    );
  });
});