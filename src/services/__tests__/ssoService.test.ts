import { PrismaClient } from '@prisma/client';
import { getSSOAuthorizationUrl, handleSSOCallback } from '../ssoService';
import { hashPassword } from '@/utils/bcrypt';
import { generateTokens } from '@/utils/jwt';
import { APIError } from '@/middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('@/utils/bcrypt');
jest.mock('@/utils/jwt');
jest.mock('uuid');
jest.mock('@/i18n', () => ({
  t: jest.fn((key) => key)
}));

// Mock global fetch
global.fetch = jest.fn();

describe('SSO Service', () => {
  let mockPrismaClient: jest.Mocked<PrismaClient>;
  let consoleErrorSpy: jest.SpyInstance;
  let mockDate: Date;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDate = new Date('2024-01-01T00:00:00Z');
    jest.spyOn(global.Date, 'now').mockImplementation(() => mockDate.getTime());

    // Mock UUID
    (uuidv4 as jest.Mock).mockReturnValue('mock-uuid');

    // Mock fetch responses
    (global.fetch as jest.Mock).mockImplementation(async (url) => {
      if (url.includes('token')) {
        return {
          ok: true,
          json: async () => ({
            access_token: 'mock-access-token'
          })
        };
      } else if (url.includes('userinfo') || url.includes('user')) {
        return {
          ok: true,
          json: async () => ({
            id: '12345',
            email: 'test@example.com',
            name: 'Test User'
          })
        };
      }
      return { ok: false };
    });

    // 创建 mock PrismaClient
    const tx = {
      users: {
        findUnique: jest.fn(),
        create: jest.fn()
      },
      login_Methods: {
        findFirst: jest.fn(),
        create: jest.fn(),
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
      login_Methods: tx.login_Methods
    } as unknown as jest.Mocked<PrismaClient>;

    // Mock hashPassword
    (hashPassword as jest.Mock).mockResolvedValue('hashedPassword123');

    // Mock generateTokens
    (generateTokens as jest.Mock).mockResolvedValue({
      accessToken: 'mock.access.token',
      refreshToken: 'mock.refresh.token'
    });

    // Mock process.env
    process.env.API_BASE_URL = 'http://localhost:3000';
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GITHUB_CLIENT_ID = 'github-client-id';
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('getSSOAuthorizationUrl', () => {
    it('应该为Google生成正确的授权URL', () => {
      const result = getSSOAuthorizationUrl('google');
      
      expect(result.state).toBe('mock-uuid');
      expect(result.url).toContain('accounts.google.com');
      expect(result.url).toContain('client_id=google-client-id');
      expect(result.url).toContain('state=mock-uuid');
    });

    it('应该为GitHub生成正确的授权URL', () => {
      const result = getSSOAuthorizationUrl('github');
      
      expect(result.state).toBe('mock-uuid');
      expect(result.url).toContain('github.com/login/oauth/authorize');
      expect(result.url).toContain('client_id=github-client-id');
      expect(result.url).toContain('state=mock-uuid');
    });

    it('应该在提供商无效时抛出错误', () => {
      expect(() => getSSOAuthorizationUrl('invalid'))
        .toThrow(APIError);
    });
  });

  describe('handleSSOCallback', () => {
    const validState = 'mock-uuid';
    const validCode = 'valid-code';

    beforeEach(() => {
      // 模拟状态缓存
      const { state } = getSSOAuthorizationUrl('google');
      (global as typeof globalThis & { 
        stateCache: Map<string, { provider: string; createdAt: number }> 
      }).stateCache = new Map([[state, {
        provider: 'google',
        createdAt: Date.now()
      }]]);
    });

    it('应该成功处理新用户的SSO回调', async () => {
      // 模拟用户不存在
      (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue(null);
      
      // 模拟创建新用户
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser'
      };
      (mockPrismaClient.users.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await handleSSOCallback('google', validCode, validState, mockPrismaClient);

      expect(result).toEqual({
        access_token: 'mock.access.token',
        refresh_token: 'mock.refresh.token',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          username: mockUser.username,
          email: mockUser.email
        }
      });

      expect(mockPrismaClient.users.create).toHaveBeenCalled();
      expect(mockPrismaClient.login_Methods.create).toHaveBeenCalled();
    });

    it('应该成功处理现有用户的SSO回调', async () => {
      // 模拟用户已存在
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        username: 'existinguser'
      };
      (mockPrismaClient.users.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const result = await handleSSOCallback('google', validCode, validState, mockPrismaClient);

      expect(result).toEqual({
        access_token: 'mock.access.token',
        refresh_token: 'mock.refresh.token',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          username: mockUser.username,
          email: mockUser.email
        }
      });

      expect(mockPrismaClient.users.create).not.toHaveBeenCalled();
      expect(mockPrismaClient.login_Methods.findFirst).toHaveBeenCalled();
    });

    it('应该在提供商无效时抛出错误', async () => {
      await expect(handleSSOCallback('invalid', validCode, validState, mockPrismaClient))
        .rejects
        .toThrow(APIError);
    });

    it('应该在状态令牌无效时抛出错误', async () => {
      await expect(handleSSOCallback('google', validCode, 'invalid-state', mockPrismaClient))
        .rejects
        .toThrow(APIError);
    });

    it('应该在获取访问令牌失败时抛出错误', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() => ({
        ok: false,
        statusText: 'Token exchange failed'
      }));

      await expect(handleSSOCallback('google', validCode, validState, mockPrismaClient))
        .rejects
        .toThrow(APIError);

    });

    it('应该在获取用户信息失败时抛出错误', async () => {
      (global.fetch as jest.Mock)
        .mockImplementationOnce(() => ({ // 第一次调用成功（获取令牌）
          ok: true,
          json: async () => ({ access_token: 'mock-token' })
        }))
        .mockImplementationOnce(() => ({ // 第二次调用失败（获取用户信息）
          ok: false,
          statusText: 'Failed to fetch user info'
        }));

      await expect(handleSSOCallback('google', validCode, validState, mockPrismaClient))
        .rejects
        .toThrow(APIError);

    });

    it('应该在数据库操作失败时抛出错误', async () => {
      const dbError = new Error('Database connection failed');
      mockPrismaClient.$transaction.mockRejectedValue(dbError);

      await expect(handleSSOCallback('google', validCode, validState, mockPrismaClient))
        .rejects
        .toThrow(APIError);

    });
  });
});