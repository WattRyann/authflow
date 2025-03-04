import { PrismaClient } from '@prisma/client';
import { login } from '../authService';
import { comparePassword } from '@/utils/bcrypt';
import { validateUsername } from '@/utils/validation';
import { verify2FAToken } from '@/utils/2fa';
import { generateTokens } from '@/utils/jwt';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/types/api';

// Mock 依赖
jest.mock('@/utils/bcrypt');
jest.mock('@/utils/validation');
jest.mock('@/utils/2fa');
jest.mock('@/utils/jwt');
jest.mock('@/i18n', () => ({
  t: (key: string) => key
}));

// Mock PrismaClient
const mockFindUnique = jest.fn();
const mockPrisma = {
  users: {
    findUnique: mockFindUnique
  }
} as unknown as PrismaClient;

describe('login', () => {
  const mockUsername = 'testuser';
  const mockPassword = 'password123';
  const mockPasswordHash = 'hashedpassword';
  const mockUserId = BigInt(1);
  const mockTokens = {
    accessToken: 'access.token',
    refreshToken: 'refresh.token'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.error
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock validateUsername
    (validateUsername as jest.Mock).mockReturnValue(true);
    
    // Mock comparePassword
    (comparePassword as jest.Mock).mockResolvedValue(true);
    
    // Mock verify2FAToken
    (verify2FAToken as jest.Mock).mockResolvedValue(true);
    
    // Mock generateTokens
    (generateTokens as jest.Mock).mockResolvedValue(mockTokens);
  });

  it('应该在用户名无效时抛出错误', async () => {
    (validateUsername as jest.Mock).mockReturnValue(false);

    await expect(login({ 
      username: mockUsername, 
      password: mockPassword 
    }, mockPrisma)).rejects.toThrow(APIError);
  });

  it('应该在用户不存在时抛出凭证错误', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(login({ 
      username: mockUsername, 
      password: mockPassword 
    }, mockPrisma)).rejects.toThrow(APIError);
  });

  it('应该在密码错误时抛出凭证错误', async () => {
    mockFindUnique.mockResolvedValue({
      id: mockUserId,
      username: mockUsername,
      password_hash: mockPasswordHash
    });
    (comparePassword as jest.Mock).mockResolvedValue(false);

    await expect(login({ 
      username: mockUsername, 
      password: mockPassword 
    }, mockPrisma)).rejects.toThrow(APIError);
  });

  it('应该在启用2FA但未提供验证码时抛出错误', async () => {
    mockFindUnique.mockResolvedValue({
      id: mockUserId,
      username: mockUsername,
      password_hash: mockPasswordHash,
      twoFactorSettings: {
        is_enabled: true,
        secret: 'secret'
      }
    });

    await expect(login({ 
      username: mockUsername, 
      password: mockPassword 
    }, mockPrisma)).rejects.toThrowError(new APIError(
      401,
      ErrorCodes.TWO_FACTOR_REQUIRED,
      'auth.errors.twoFactorRequired',
      { requires2FA: true }
    ));
  });

  it('应该在2FA验证码无效时抛出错误', async () => {
    mockFindUnique.mockResolvedValue({
      id: mockUserId,
      username: mockUsername,
      password_hash: mockPasswordHash,
      twoFactorSettings: {
        is_enabled: true,
        secret: 'secret'
      }
    });
    (verify2FAToken as jest.Mock).mockResolvedValue(false);

    await expect(login({ 
      username: mockUsername, 
      password: mockPassword,
      two_factor_code: '123456'
    }, mockPrisma)).rejects.toThrow(APIError);
  });

  it('应该在验证成功时返回令牌', async () => {
    mockFindUnique.mockResolvedValue({
      id: mockUserId,
      username: mockUsername,
      password_hash: mockPasswordHash,
      twoFactorSettings: {
        is_enabled: false
      }
    });

    const result = await login({ 
      username: mockUsername, 
      password: mockPassword 
    }, mockPrisma);

    expect(result).toEqual({
      access_token: mockTokens.accessToken,
      token_type: 'bearer',
      refresh_token: mockTokens.refreshToken,
      expires_in: 3600,
      requires2FA: false
    });
  });

  it('应该在2FA验证成功时返回令牌', async () => {
    mockFindUnique.mockResolvedValue({
      id: mockUserId,
      username: mockUsername,
      password_hash: mockPasswordHash,
      twoFactorSettings: {
        is_enabled: true,
        secret: 'secret'
      }
    });

    const result = await login({ 
      username: mockUsername, 
      password: mockPassword,
      two_factor_code: '123456'
    }, mockPrisma);

    expect(result).toEqual({
      access_token: mockTokens.accessToken,
      token_type: 'bearer',
      refresh_token: mockTokens.refreshToken,
      expires_in: 3600,
      requires2FA: false
    });
  });

  it('应该在发生未知错误时抛出内部服务器错误', async () => {
    mockFindUnique.mockRejectedValue(new Error('Database error'));

    await expect(login({ 
      username: mockUsername, 
      password: mockPassword 
    }, mockPrisma)).rejects.toThrow(APIError);
  });
});