import { PrismaClient } from '@prisma/client';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes, TwoFactorSetupData, TwoFactorVerifyRequest, TwoFactorVerifyResponse } from '@/types/api';
import i18n from '@/i18n';
import defaultPrisma from '@/lib/prisma';
import { generate2FASecret, generateBackupCodes, hashBackupCode, verify2FAToken } from '@/utils/2fa';
import qrcode from 'qrcode';

/**
 * 启用两步验证（2FA）
 * 
 * 流程：
 * 1. 检查用户是否已启用2FA
 * 2. 生成TOTP密钥和对应的otpauth URI
 * 3. 生成QR码URL
 * 4. 生成备份码
 * 5. 保存密钥和备份码（未激活状态）
 * 
 * 安全考虑：
 * - 使用事务确保数据一致性
 * - 备份码使用SHA-256哈希存储
 * - 返回的密钥和备份码仅在设置过程中显示一次
 * 
 * @param {number} userId - 用户ID
 * @param {string} username - 用户名，用于生成TOTP URI
 * @param {PrismaClient} prisma - Prisma客户端实例（可选，用于依赖注入）
 * @returns {Promise<TwoFactorSetupData>} 包含密钥、QR码URL和备份码的设置数据
 * @throws {APIError} 当用户已启用2FA或发生其他错误时
 */
export async function enable2FA(
  userId: number,
  username: string,
  prisma: PrismaClient = defaultPrisma
): Promise<TwoFactorSetupData> {
  try {
    // 检查用户是否已启用2FA
    const existingSettings = await prisma.two_Factor_Settings.findUnique({
      where: { user_id: userId }
    });

    if (existingSettings?.is_enabled) {
      throw new APIError(
        400,
        ErrorCodes.TWO_FACTOR_ALREADY_ENABLED,
        i18n.t('2fa.errors.alreadyEnabled')
      );
    }

    // 生成TOTP密钥和otpauth URI
    const { secret, otpauth } = generate2FASecret(username);
    
    // 生成QR码URL
    const qrCodeUrl = await qrcode.toDataURL(otpauth);
    
    // 生成备份码
    const backupCodes = generateBackupCodes();
    
    // 使用事务保存密钥和备份码
    await prisma.$transaction(async (tx) => {
      // 保存或更新2FA设置（未激活状态）
      await tx.two_Factor_Settings.upsert({
        where: { user_id: userId },
        update: {
          secret,
          is_enabled: false
        },
        create: {
          user_id: userId,
          secret,
          is_enabled: false
        }
      });
      
      // 删除旧的备份码（如果有）
      await tx.two_Factor_Backup_Codes.deleteMany({
        where: { user_id: userId }
      });
      
      // 保存新的备份码（哈希存储）
      const backupCodesData = backupCodes.map(code => ({
        user_id: userId,
        code_hash: hashBackupCode(code),
        is_used: false
      }));
      
      await tx.two_Factor_Backup_Codes.createMany({
        data: backupCodesData
      });
    });
    
    // 返回设置数据
    return {
      secret,
      qr_code_url: qrCodeUrl,
      backup_codes: backupCodes
    };
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    console.error('2FA启用错误:', error);
    throw new APIError(
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      i18n.t('common.errors.internalServerError')
    );
  }
}

/**
 * 验证并激活两步验证（2FA）
 * 
 * 流程：
 * 1. 检查用户是否已有2FA设置（未激活）
 * 2. 验证用户提供的验证码
 * 3. 激活2FA设置
 * 
 * 安全考虑：
 * - 使用事务确保数据一致性
 * - 验证码使用TOTP算法验证
 * - 记录2FA启用时间用于审计
 * 
 * @param {number} userId - 用户ID
 * @param {TwoFactorVerifyRequest} params - 包含验证码的请求参数
 * @param {PrismaClient} prisma - Prisma客户端实例（可选，用于依赖注入）
 * @returns {Promise<TwoFactorVerifyResponse>} 包含2FA启用状态的响应
 * @throws {APIError} 当验证失败或发生其他错误时
 */
export async function verify2FA(
  userId: number,
  { code }: TwoFactorVerifyRequest,
  prisma: PrismaClient = defaultPrisma
): Promise<TwoFactorVerifyResponse> {
  try {
    // 获取用户的2FA设置
    const settings = await prisma.two_Factor_Settings.findUnique({
      where: { user_id: userId }
    });
    
    // 检查是否已有2FA设置
    if (!settings) {
      throw new APIError(
        400,
        ErrorCodes.INVALID_STATE,
        i18n.t('2fa.errors.notInitialized')
      );
    }
    
    // 检查2FA是否已激活
    if (settings.is_enabled) {
      throw new APIError(
        400,
        ErrorCodes.TWO_FACTOR_ALREADY_ENABLED,
        i18n.t('2fa.errors.alreadyEnabled')
      );
    }
    
    // 验证用户提供的验证码
    const isValid = await verify2FAToken(settings.secret, code);
    
    if (!isValid) {
      throw new APIError(
        400,
        ErrorCodes.INVALID_2FA_CODE,
        i18n.t('2fa.errors.invalidCode'),
        { field: 'code', reason: 'Invalid 2FA code' }
      );
    }
    
    // 激活2FA设置
    await prisma.two_Factor_Settings.update({
      where: { user_id: userId },
      data: {
        is_enabled: true,
        enabled_at: new Date()
      }
    });
    
    // 返回2FA启用状态
    return { two_factor_enabled: true };
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    console.error('2FA验证错误:', error);
    throw new APIError(
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      i18n.t('common.errors.internalServerError')
    );
  }
}