import jwt, { JwtPayload } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import ms, { StringValue } from 'ms';
import { PrismaClient } from '@prisma/client';
import defaultPrisma from '@/lib/prisma';

// 环境变量处理，增加生产环境检查
const {
  JWT_ACCESS_SECRET = process.env.NODE_ENV === 'production' ? undefined : 'your-access-secret',
  JWT_REFRESH_SECRET = process.env.NODE_ENV === 'production' ? undefined : 'your-refresh-secret',
  JWT_ACCESS_EXPIRES = '1h',
  JWT_REFRESH_EXPIRES = '7d'
} = process.env;

// 生产环境下必须设置密钥
if (process.env.NODE_ENV === 'production') {
  if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
    throw new Error('JWT secrets must be set in production environment');
  }
}

const ACCESS_SECRET = JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = JWT_REFRESH_SECRET as string;
const ACCESS_EXPIRES = JWT_ACCESS_EXPIRES as string;
const REFRESH_EXPIRES = JWT_REFRESH_EXPIRES as string;

interface TokenPayload {
  user_id: number;
  jti: string;
}

interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * 生成访问令牌和刷新令牌，并将刷新令牌存储到数据库中。
 *
 * @param userId 用户的唯一标识（bigint 类型）
 * @param prisma 可选的 PrismaClient 实例，默认为默认实例（便于依赖注入和测试）
 * @returns 包含 accessToken 和 refreshToken 的对象
 */
export async function generateTokens(
  userId: bigint,
  prisma: PrismaClient = defaultPrisma
): Promise<GeneratedTokens> {
  // 将 bigint 转换为 number（假设用户 ID 在安全范围内）
  const userIdNumber = Number(userId);
  
  // 生成唯一的令牌 ID（jti）
  const jti = uuidv4();

  // 定义签名选项
  const signOptions = {
    expiresIn: ACCESS_EXPIRES,
    algorithm: 'HS256'
  } as jwt.SignOptions;

  // 生成访问令牌
  const accessToken = jwt.sign(
    { user_id: userIdNumber, jti } as TokenPayload,
    ACCESS_SECRET as jwt.Secret,
    signOptions
  );

  // 生成刷新令牌
  const refreshToken = jwt.sign(
    { user_id: userIdNumber, jti } as TokenPayload,
    REFRESH_SECRET as jwt.Secret,
    { ...signOptions, expiresIn: REFRESH_EXPIRES } as jwt.SignOptions
  );
  
  try {
    // 使用 ms 库将刷新令牌的过期时间转换为毫秒
    const refreshExpiresMs = ms(REFRESH_EXPIRES as StringValue);
    await prisma.refresh_Tokens.create({
      data: {
        token: refreshToken,
        user_id: userIdNumber,
        expires_at: new Date(Date.now() + refreshExpiresMs)
      }
    });

    return { accessToken, refreshToken };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Failed to store refresh token:', error);
    }
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to generate authentication tokens');
    }
  }
}

/**
 * 验证访问令牌
 * 
 * @param token 要验证的访问令牌
 * @returns 解码后的令牌载荷，如果验证失败则抛出错误
 */
export function verifyAccessToken(token: string): TokenPayload & JwtPayload {
  try {
    return jwt.verify(token, ACCESS_SECRET) as TokenPayload & JwtPayload;
  } catch {
    throw new Error('Invalid or expired access token');
  }
}

/**
 * 验证刷新令牌并检查其是否存在于数据库中
 * 
 * @param token 要验证的刷新令牌
 * @param prisma 可选的 PrismaClient 实例
 * @returns 解码后的令牌载荷，如果验证失败则抛出错误
 */
export async function verifyRefreshToken(
  token: string,
  prisma: PrismaClient = defaultPrisma
): Promise<TokenPayload & JwtPayload> {
  try {
    // 验证令牌签名和过期时间
    const payload = jwt.verify(token, REFRESH_SECRET) as TokenPayload & JwtPayload;
    
    // 检查令牌是否存在于数据库中
    const storedToken = await prisma.refresh_Tokens.findUnique({
      where: { token }
    });
    
    if (!storedToken) {
      throw new Error('Refresh token not found');
    }
    
    return payload;
  } catch {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * 撤销刷新令牌（用于登出）
 * 
 * @param token 要撤销的刷新令牌
 * @param prisma 可选的 PrismaClient 实例
 */
export async function revokeRefreshToken(
  token: string,
  prisma: PrismaClient = defaultPrisma
): Promise<void> {
  try {
    await prisma.refresh_Tokens.delete({
      where: { token }
    });
  } catch (error) {
    console.error('Failed to revoke refresh token:', error);
    throw new Error('Failed to revoke authentication token');
  }
}
