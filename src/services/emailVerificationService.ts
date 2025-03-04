import { PrismaClient } from '@prisma/client';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes, EmailVerificationRequest, EmailVerificationResponse } from '@/types/api';
import i18n from '@/i18n';
import defaultPrisma from '@/lib/prisma';

/**
 * 验证用户邮箱。
 * 
 * 流程：
 * 1. 验证验证码格式
 * 2. 检查用户邮箱是否已验证
 * 3. 查找并验证验证码
 * 4. 更新用户邮箱验证状态
 * 
 * 安全考虑：
 * - 验证码使用后立即标记为已使用
 * - 使用事务确保数据一致性
 * - 验证码过期检查
 * 
 * @param {number} userId - 用户ID
 * @param {EmailVerificationRequest} params - 验证请求参数
 * @param {PrismaClient} prisma - Prisma 客户端实例（可选，用于依赖注入）
 * @returns {Promise<EmailVerificationResponse>} - 验证结果
 * @throws {APIError} - 当验证失败时抛出错误
 */
export async function verifyEmail(
  userId: number,
  { code }: EmailVerificationRequest,
  prisma: PrismaClient = defaultPrisma
): Promise<EmailVerificationResponse> {
  try {
    // 验证码格式验证
    if (!code || code.length !== 6) {
      throw new APIError(
        400,
        ErrorCodes.INVALID_CODE,
        i18n.t('user.errors.invalidVerificationCode'),
        { field: 'code', reason: 'Invalid format' }
      );
    }

    // 使用事务确保数据一致性
    return await prisma.$transaction(async (tx) => {
      // 检查用户邮箱是否已验证
      const user = await tx.users.findUnique({
        where: { id: userId },
        select: { email_verified: true }
      });

      if (user?.email_verified) {
        throw new APIError(
          400,
          ErrorCodes.EMAIL_ALREADY_VERIFIED,
          i18n.t('user.errors.emailAlreadyVerified')
        );
      }

      // 查找验证码记录
      const verification = await tx.email_Verifications.findFirst({
        where: {
          user_id: userId,
          token: code,
          is_used: false,
          expires_at: { gt: new Date() }
        }
      });

      if (!verification) {
        throw new APIError(
          400,
          ErrorCodes.INVALID_CODE,
          i18n.t('user.errors.invalidOrExpiredCode'),
          { field: 'code', reason: 'Invalid or expired code' }
        );
      }

      // 标记验证码为已使用
      await tx.email_Verifications.update({
        where: { id: verification.id },
        data: { is_used: true }
      });

      // 更新用户邮箱验证状态
      await tx.users.update({
        where: { id: userId },
        data: { email_verified: true }
      });

      return { is_email_verified: true };
    });

  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    console.error('Email verification error:', error);
    throw new APIError(
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      i18n.t('common.errors.internalServerError')
    );
  }
}