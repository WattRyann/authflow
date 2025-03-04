import { NextRequest, NextResponse } from 'next/server';
import { changePassword } from '@/services/userService';
import { APIResponse, ErrorCodes, ChangePasswordRequest } from '@/types/api';
import { withAuth, extractTokenFromRequest } from '@/middleware/authMiddleware';
import { APIError } from '@/middleware/errorHandler';
import { passwordLimiter } from '@/middleware/rateLimit';
import i18n from '@/i18n';

// 辅助函数，返回一致的 JSON 错误响应
function jsonError(message: string, code: ErrorCodes, status: number): NextResponse<APIResponse<null>> {
  return NextResponse.json({
    status: 'error',
    data: null,
    message,
    code,
  }, { status });
}

// 辅助函数，返回一致的 JSON 成功响应
function jsonSuccess<T>(data: T, message: string): NextResponse<APIResponse<T>> {
  return NextResponse.json({
    status: 'success',
    data,
    message,
  }, { status: 200 });
}

/**
 * 处理修改密码的 PATCH 请求
 */
export async function patchHandler(
  request: NextRequest,
  userId: number
): Promise<NextResponse<APIResponse<null>>> {
  try {
    // 验证访问令牌
    const accessToken = extractTokenFromRequest(request);
    if (!accessToken) {
      return jsonError(i18n.t('auth.errors.invalidToken'), ErrorCodes.INVALID_TOKEN, 401);
    }

    // 应用速率限制（5次/用户/小时）
    const rateLimitResult = await passwordLimiter.check(request, userId.toString());
    if (!rateLimitResult.success) {
      return jsonError(
        i18n.t('auth.errors.rateLimitExceeded'),
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        429
      );
    }

    // 解析请求体
    const body = await request.json() as ChangePasswordRequest;
    
    // 调用服务层方法更新密码
    await changePassword(userId, body);

    // 返回成功响应
    return jsonSuccess(
      null,
      i18n.t('user.messages.passwordUpdated')
    );

  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Change password error:', error);
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