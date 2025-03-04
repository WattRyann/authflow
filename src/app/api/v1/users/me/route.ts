import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserInfo } from '@/services/userService';
import { APIResponse, UserInfo, ErrorCodes } from '@/types/api';
import { withAuth, extractTokenFromRequest } from '@/middleware/authMiddleware';
import { APIError } from '@/middleware/errorHandler';
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
 * 处理获取当前用户信息的请求
 */
export async function getUserHandler(
  request: NextRequest,
  userId: number
): Promise<NextResponse<APIResponse<UserInfo | null>>> {
  try {
    // 从请求头中提取访问令牌
    const accessToken = extractTokenFromRequest(request);
    if (!accessToken) {
      return jsonError(i18n.t('auth.errors.invalidToken'), ErrorCodes.INVALID_TOKEN, 401);
    }

    // 获取用户信息
    const userInfo = await getCurrentUserInfo(userId);

    // 返回成功响应
    return jsonSuccess<UserInfo>(
      userInfo,
      i18n.t('user.messages.infoRetrieved')
    );

  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Get user info error:', error);
    }

    // 检查是否为已知的 APIError
    if (error instanceof APIError) {
      return jsonError(error.message, error.code as ErrorCodes, error.statusCode);
    }

    // 否则返回服务器错误
    return jsonError(
      i18n.t('common.errors.internalServerError'),
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500
    );
  }
}

// 保留现有的 GET 处理函数
export const GET = withAuth(getUserHandler);