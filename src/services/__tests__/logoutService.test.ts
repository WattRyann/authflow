import { PrismaClient } from '@prisma/client';
import { logout } from '@/services/logoutService';
import { verifyAccessToken, verifyRefreshToken } from '@/utils/jwt';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes, LogoutRequest } from '@/types/api';

// Mock dependencies
jest.mock('@/utils/jwt');
jest.mock('@prisma/client');
jest.mock('@/i18n', () => ({
  t: jest.fn().mockImplementation((key) => key)
}));

describe('logout', () => {
  let mockPrismaClient: jest.Mocked<PrismaClient>;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Create a mocked PrismaClient
    mockPrismaClient = {
      $transaction: jest.fn((callback) => {
        // Simulate a transaction by calling the callback with the mock client.
        return callback(mockPrismaClient);
      }),
      blacklisted_Tokens: {
        create: jest.fn().mockResolvedValue({})
      },
      refresh_Tokens: {
        delete: jest.fn().mockResolvedValue({})
      }
    } as unknown as jest.Mocked<PrismaClient>;

    // Mock verifyAccessToken to return a valid payload.
    (verifyAccessToken as jest.Mock).mockReturnValue({
      user_id: 1,
      jti: 'test-access-jti'
    });

    // Mock verifyRefreshToken to return a valid payload.
    (verifyRefreshToken as jest.Mock).mockResolvedValue({
      user_id: 1,
      jti: 'test-refresh-jti'
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  const validEmail = 'test@example.com';

  it('should successfully logout user with access token only', async () => {
    await expect(logout('valid-access-token', {}, mockPrismaClient)).resolves.not.toThrow();
    
    // Ensure access token verification is called.
    expect(verifyAccessToken).toHaveBeenCalledWith('valid-access-token');
    // Verify transaction is invoked.
    expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    // Ensure the access token is added to the blacklist.
    expect(mockPrismaClient.blacklisted_Tokens.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 1,
        token_identifier: 'test-access-jti',
        token_type: 'access',
        expires_at: expect.any(Date)
      })
    });
    // Verify that refresh token functions are not called.
    expect(verifyRefreshToken).not.toHaveBeenCalled();
    expect(mockPrismaClient.refresh_Tokens.delete).not.toHaveBeenCalled();
  });

  it('should successfully logout user with both access and refresh tokens', async () => {
    const params: LogoutRequest = { refresh_token: 'valid-refresh-token' };
    
    await expect(logout('valid-access-token', params, mockPrismaClient)).resolves.not.toThrow();
    
    expect(verifyAccessToken).toHaveBeenCalledWith('valid-access-token');
    expect(verifyRefreshToken).toHaveBeenCalledWith('valid-refresh-token', mockPrismaClient);
    expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    
    // Verify access token is blacklisted.
    expect(mockPrismaClient.blacklisted_Tokens.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 1,
        token_identifier: 'test-access-jti',
        token_type: 'access'
      })
    });
    
    // Verify refresh token is blacklisted.
    expect(mockPrismaClient.blacklisted_Tokens.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 1,
        token_identifier: 'test-refresh-jti',
        token_type: 'refresh'
      })
    });
    
    // Verify refresh token deletion.
    expect(mockPrismaClient.refresh_Tokens.delete).toHaveBeenCalledWith({
      where: { token: 'valid-refresh-token' }
    });
  });

  it('should continue processing access token if refresh token is invalid', async () => {
    const params: LogoutRequest = { refresh_token: 'invalid-refresh-token' };
    
    // Simulate refresh token validation failure.
    (verifyRefreshToken as jest.Mock).mockRejectedValue(new Error('Invalid refresh token'));
    
    await expect(logout('valid-access-token', params, mockPrismaClient)).resolves.not.toThrow();
    
    expect(verifyAccessToken).toHaveBeenCalledWith('valid-access-token');
    expect(verifyRefreshToken).toHaveBeenCalledWith('invalid-refresh-token', mockPrismaClient);
    
    // Expect a warning to be logged.
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Invalid refresh token during logout:',
      expect.any(Error)
    );
    
    // Ensure only the access token is blacklisted.
    expect(mockPrismaClient.blacklisted_Tokens.create).toHaveBeenCalledTimes(1);
    expect(mockPrismaClient.blacklisted_Tokens.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        token_type: 'access'
      })
    });
    
    // No deletion of refresh token should occur.
    expect(mockPrismaClient.refresh_Tokens.delete).not.toHaveBeenCalled();
  });

  it('should throw APIError if access token is invalid', async () => {
    // Simulate invalid access token by throwing an APIError.
    (verifyAccessToken as jest.Mock).mockImplementation(() => {
      throw new APIError(401, ErrorCodes.INVALID_TOKEN, 'Invalid token');
    });
    
    await expect(logout('invalid-access-token', {}, mockPrismaClient)).rejects.toThrow(APIError);
    
    // Ensure the transaction is not invoked.
    expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
  });

  it('should throw APIError when database operation fails', async () => {
    // Simulate a failure in the transaction.
    mockPrismaClient.$transaction.mockRejectedValue(new Error('Database error'));
    
    await expect(logout('valid-access-token', {}, mockPrismaClient)).rejects.toThrow(APIError);
    
    // Verify that an error is logged.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Logout error:',
      expect.any(Error)
    );
  });  
});
