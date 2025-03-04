import { NextRequest, NextResponse } from 'next/server';
import { APIResponse, ErrorCodes, EmailVerificationRequest, EmailVerificationResponse } from '@/types/api';
import { withAuth, extractTokenFromRequest } from '@/middleware/authMiddleware';
import { APIError } from '@/middleware/errorHandler';
import { verifyEmail } from '@/services/emailVerificationService';
import i18n from '@/i18n';

// 辅助函数，返回一致的 JSON 错误响应
export function jsonError(message: string, code: ErrorCodes, status: number): NextResponse<APIResponse<null>> {
  return NextResponse.json({
    status: 'error',
    data: null,
    message,
    code,
  }, { status });
}

// 辅助函数，返回一致的 JSON 成功响应
export function jsonSuccess<T>(data: T, message: string): NextResponse<APIResponse<T>> {
  return NextResponse.json({
    status: 'success',
    data,
    message,
  }, { status: 200 });
}

/**
 * 处理验证邮箱的请求
 * 
 * 该路由处理用户提交的验证码，验证其邮箱地址。
 * 验证成功后，用户的邮箱将被标记为已验证。
 * 
 * @param {NextRequest} request - 包含验证码的请求
 * @param {number} userId - 从认证中间件获取的用户ID
 * @returns {Promise<NextResponse>} - 包含验证结果的响应
 */
export async function patchHandler(
  request: NextRequest,
  userId: number
): Promise<NextResponse<APIResponse<EmailVerificationResponse | null>>> {
  try {
    // 验证访问令牌
    const accessToken = extractTokenFromRequest(request);
    if (!accessToken) {
      return jsonError(i18n.t('auth.errors.invalidToken'), ErrorCodes.INVALID_TOKEN, 401);
    }

    // 解析请求体获取验证码
    const body = await request.json() as EmailVerificationRequest;
    const { code } = body;

    // 验证邮箱
    const result = await verifyEmail(userId, { code });

    // 返回成功响应
    return jsonSuccess<EmailVerificationResponse>(
      result,
      i18n.t('user.messages.emailVerifiedSuccess')
    );

  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Email verification error:', error);
    }

    // 处理已知的 API 错误
    if (error instanceof APIError) {
      return jsonError(error.message, error.code as ErrorCodes, error.statusCode);
    }

    // 处理未知错误
    return jsonError(
      i18n.t('common.errors.internalServerError'),
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500
    );
  }
}

// 导出路由处理函数，使用认证中间件包装
export const PATCH = withAuth(patchHandler);