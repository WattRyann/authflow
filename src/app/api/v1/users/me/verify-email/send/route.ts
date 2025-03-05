import { NextRequest, NextResponse } from 'next/server';
import { APIResponse, ErrorCodes } from '@/types/api';
import { withAuth } from '@/middleware/authMiddleware';
import { APIError } from '@/middleware/errorHandler';
import { emailVerificationLimiter } from '@/middleware/rateLimit';
import { sendVerificationEmail } from '@/utils/mailer';
import { getUserEmailStatus, generateEmailVerificationToken } from '@/services/userService';
import i18n from '@/i18n';
import { jsonError, jsonSuccess } from '@/utils/apiResponse';

/**
 * 处理发送邮箱验证邮件的请求
 */
async function postHandler(
  request: NextRequest,
  userId: number
): Promise<NextResponse<APIResponse<null>>> {
  try {

    // 检查速率限制（3次/用户/天）
    const rateLimitResult = await emailVerificationLimiter.check(request, userId.toString());
    if (!rateLimitResult.success) {
      return jsonError(
        i18n.t('auth.errors.rateLimitExceeded'),
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        429
      );
    }

    // 检查邮箱是否已验证
    const { isVerified } = await getUserEmailStatus(userId);
    if (isVerified) {
      return jsonError(
        i18n.t('user.errors.emailAlreadyVerified'),
        ErrorCodes.EMAIL_ALREADY_VERIFIED,
        400
      );
    }

    const { email, token } = await generateEmailVerificationToken(userId);
    await sendVerificationEmail(email, token);

    // 返回成功响应
    return jsonSuccess(
      null,
      i18n.t('user.messages.verificationEmailSent')
    );

  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Send verification email error:', error);
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
export const POST = withAuth(postHandler);
