import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/types/api';
import i18n from '@/i18n';

/**
 * 从请求头中提取 Bearer 令牌
 * 
 * @param {NextRequest} request - Next.js 请求对象
 * @returns {string|null} - 提取的令牌或 null
 */
export function extractTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // 移除 'Bearer ' 前缀
}

/**
 * 验证请求中的访问令牌
 * 
 * @param {NextRequest} request - Next.js 请求对象
 * @returns {Promise<{ isValid: boolean; userId?: number; error?: APIError }>} - 验证结果
 */
export async function validateAccessToken(request: NextRequest): Promise<{ 
  isValid: boolean; 
  userId?: number; 
  error?: APIError 
}> {
  try {
    const token = extractTokenFromRequest(request);
    
    if (!token) {
      return { 
        isValid: false, 
        error: new APIError(
          401, 
          ErrorCodes.UNAUTHORIZED, 
          i18n.t('auth.errors.unauthorized')
        ) 
      };
    }
    
    const payload = verifyAccessToken(token);
    return { isValid: true, userId: payload.user_id };
  } catch (error) {
    if (error instanceof APIError) {
      return { isValid: false, error };
    }
    
    return { 
      isValid: false, 
      error: new APIError(
        401, 
        ErrorCodes.INVALID_TOKEN, 
        i18n.t('auth.errors.invalidToken')
      ) 
    };
  }
}

/**
 * 授权中间件 - 用于 API 路由处理程序
 * 
 * @param {NextRequest} request - Next.js 请求对象
 * @param {Function} handler - 路由处理函数
 * @returns {Promise<NextResponse>} - Next.js 响应对象
 */
export async function authMiddleware(
  request: NextRequest,
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  const { isValid, userId, error } = await validateAccessToken(request);
  
  if (!isValid) {
    return NextResponse.json(
      {
        status: 'error',
        data: null,
        message: error?.message || i18n.t('auth.errors.unauthorized'),
        code: error?.code || ErrorCodes.UNAUTHORIZED
      },
      { status: error?.statusCode || 401 }
    );
  }
  
  return handler(request, userId!);
}

/**
 * 授权中间件工厂函数 - 创建一个包装了授权逻辑的处理函数
 * 
 * @param {Function} handler - 需要授权的路由处理函数
 * @returns {Function} - 包装后的处理函数
 */
export function withAuth(
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return (request: NextRequest) => authMiddleware(request, handler);
}