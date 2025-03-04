import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/utils/bcrypt';
import { validateUsername, validateEmail, validatePassword } from '@/utils/validation';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes, UserInfo, RegisterRequest, RegisterResponse } from '@/types/api';
import { sendVerificationEmail } from '@/utils/mailer';
import crypto from 'crypto';
import i18n from '@/i18n';
import defaultPrisma from '@/lib/prisma';
import { comparePassword } from '@/utils/bcrypt';
import { ChangePasswordRequest } from '@/types/api';

// Constants: Token expiry duration and random byte length
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_BYTE_LENGTH = 32; // 32 random bytes generate a 64-character hexadecimal string

/**
 * Registers a new user.
 *
 * Process:
 * 1. Validate input parameters (username, email, and password).
 * 2. Start a transaction:
 *    a. Check if the username or email already exists.
 *    b. Create the new user.
 *    c. Generate an email verification token and record it.
 * 3. Send the verification email.
 * 4. Return the new user's information.
 *
 * Security Considerations:
 * - Input validation with localized error messages.
 * - Use of transactions to ensure data consistency.
 * - The verification email is sent after successful user creation.
 *
 * @param {RegisterRequest} params - The registration request parameters.
 * @param {PrismaClient} prisma - An optional PrismaClient instance for dependency injection (defaults to the default instance).
 * @returns {Promise<RegisterResponse>} The registered user's information.
 * @throws {APIError} When input validation fails or if an internal error occurs.
 */
export async function register(
  { username, email, password }: RegisterRequest,
  prisma: PrismaClient = defaultPrisma
): Promise<RegisterResponse> {
  // Input validation using localized error messages.
  if (!validateUsername(username)) {
    throw new APIError(
      400,
      ErrorCodes.INVALID_USERNAME,
      i18n.t('auth.invalidUsername'),
      { field: 'username', reason: 'Invalid format' }
    );
  }
  if (!validateEmail(email)) {
    throw new APIError(
      400,
      ErrorCodes.INVALID_EMAIL,
      i18n.t('auth.invalidEmail'),
      { field: 'email', reason: 'Invalid format' }
    );
  }
  if (!validatePassword(password)) {
    throw new APIError(
      400,
      ErrorCodes.INVALID_PASSWORD,
      i18n.t('auth.invalidPassword'),
      { field: 'password', reason: 'Invalid format' }
    );
  }

  try {
    // Use a transaction to ensure data consistency.
    const { user, verificationToken } = await prisma.$transaction(async (tx) => {
      // Check if the username or email is already in use.
      const [existingUsername, existingEmail] = await Promise.all([
        tx.users.findUnique({ where: { username } }),
        tx.users.findUnique({ where: { email } })
      ]);

      if (existingUsername) {
        throw new APIError(
          400,
          ErrorCodes.REG_USERNAME_EXISTS,
          i18n.t('auth.usernameExists'),
          { field: 'username', reason: 'Already exists' }
        );
      }
      if (existingEmail) {
        throw new APIError(
          400,
          ErrorCodes.REG_EMAIL_EXISTS,
          i18n.t('auth.emailExists'),
          { field: 'email', reason: 'Already exists' }
        );
      }

      // Create the new user with initial inactive and unverified state.
      const hashedPassword = await hashPassword(password);
      const newUser = await tx.users.create({
        data: {
          username,
          email,
          password_hash: hashedPassword,
          is_active: false,
          email_verified: false,
          roles: {
            create: {
              role: {
                connectOrCreate: {
                  where: { name: 'user' },
                  create: { name: 'user' }
                }
              }
            }
          }
        }
      });

      // Generate an email verification token.
      const token = crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
      const emailToken = await tx.email_Verifications.create({
        data: {
          user_id: newUser.id,
          token,
          expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS)
        }
      });

      return { user: newUser, verificationToken: emailToken };
    });

    // Send the verification email. If sending fails, the error will be caught below.
    await sendVerificationEmail(user.email, verificationToken.token);

    // Return the new user's information.
    return {
      user_id: String(user.id),
      username: user.username || '', // Ensure username is returned as a string
      email: user.email
    };

  } catch (error) {
    // If the error is an instance of APIError, rethrow it.
    if (error instanceof APIError) {
      throw error;
    }
    if (process.env.NODE_ENV !== 'test') {
      // 记录错误但不暴露详细信息
      console.error('Registration error:', error);
    }
    throw new APIError(
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      i18n.t('auth.registrationFailed')
    );
  }
}

/**
 * 获取当前用户信息
 * 
 * 流程：
 * 1. 根据用户ID从数据库获取用户记录
 * 2. 获取用户关联的角色信息
 * 3. 组装并返回用户信息对象
 * 
 * 安全考虑：
 * - 不返回敏感信息如密码哈希
 * - 使用类型安全的响应格式
 * - 对不存在的用户返回明确的错误
 * 
 * @param {number} userId - 当前认证用户的ID
 * @param {PrismaClient} prisma - 可选的Prisma客户端实例，用于依赖注入
 * @returns {Promise<UserInfo>} 用户信息对象
 * @throws {APIError} 如果用户不存在或发生其他错误
 */
export async function getCurrentUserInfo(
  userId: number,
  prisma: PrismaClient = defaultPrisma
): Promise<UserInfo> {
  try {
    // 从数据库获取用户记录，包括两步验证设置
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        twoFactorSettings: true,
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    // 如果用户不存在，抛出错误
    if (!user) {
      throw new APIError(
        404,
        ErrorCodes.USER_NOT_FOUND,
        i18n.t('user.errors.userNotFound')
      );
    }

    // 从用户角色关系中提取角色名称
    const roles = user.roles.map(ur => ur.role.name);

    // 组装用户信息对象，符合UserInfo接口
    const userInfo: UserInfo = {
      username: user.username || '',
      email: user.email,
      roles: roles,
      is_email_verified: user.email_verified,
      two_factor_enabled: user.twoFactorSettings?.is_enabled || false
    };

    return userInfo;
  } catch (error) {
    // 如果错误已经是APIError类型，直接抛出
    if (error instanceof APIError) {
      throw error;
    }

    // 记录错误但不暴露详细信息
    console.error('获取用户信息错误:', error);
    throw new APIError(
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      i18n.t('common.errors.internalServerError')
    );
  }
}

/**
 * 检查用户是否存在
 * 
 * 用于在其他服务中快速验证用户存在性
 * 
 * @param {number} userId - 用户ID
 * @param {PrismaClient} prisma - 可选的Prisma客户端实例
 * @returns {Promise<boolean>} 用户是否存在
 */
export async function userExists(
  userId: number,
  prisma: PrismaClient = defaultPrisma
): Promise<boolean> {
  const count = await prisma.users.count({
    where: { id: userId }
  });
  
  return count > 0;
}

/**
 * 修改用户密码
 * 
 * 流程：
 * 1. 验证旧密码是否正确
 * 2. 验证新密码格式
 * 3. 更新密码并记录修改时间
 * 
 * 安全考虑：
 * - 验证旧密码确保操作安全
 * - 新密码必须符合复杂度要求
 * - 使用事务确保数据一致性
 * - 记录密码修改时间用于安全审计
 * 
 * @param {number} userId - 当前用户ID
 * @param {ChangePasswordRequest} params - 包含旧密码和新密码的请求参数
 * @param {PrismaClient} prisma - 可选的Prisma客户端实例
 * @throws {APIError} 当密码验证失败或发生其他错误时
 */
export async function changePassword(
  userId: number,
  { old_password, new_password }: ChangePasswordRequest,
  prisma: PrismaClient = defaultPrisma
): Promise<void> {
  try {
    // 验证新密码格式
    if (!validatePassword(new_password)) {
      throw new APIError(
        400,
        ErrorCodes.INVALID_PASSWORD,
        i18n.t('auth.invalidPassword'),
        { field: 'new_password', reason: 'Invalid format' }
      );
    }

    // 使用事务确保数据一致性
    await prisma.$transaction(async (tx) => {
      // 获取用户当前密码哈希
      const user = await tx.users.findUnique({
        where: { id: userId },
        select: { password_hash: true }
      });

      if (!user) {
        throw new APIError(
          404,
          ErrorCodes.USER_NOT_FOUND,
          i18n.t('user.errors.userNotFound')
        );
      }

      // 验证旧密码
      const isOldPasswordValid = await comparePassword(old_password, user.password_hash);
      if (!isOldPasswordValid) {
        throw new APIError(
          401,
          ErrorCodes.INCORRECT_PASSWORD,
          i18n.t('auth.incorrectPassword'),
          { field: 'old_password', reason: 'Incorrect password' }
        );
      }

      // 生成新密码哈希
      const newPasswordHash = await hashPassword(new_password);

      // 更新密码和修改时间
      await tx.users.update({
        where: { id: userId },
        data: {
          password_hash: newPasswordHash,
          password_changed_at: new Date()
        }
      });
    });

  } catch (error) {
    // 如果是已知的 APIError，直接抛出
    if (error instanceof APIError) {
      throw error;
    }

    // 记录错误但不暴露详细信息
    console.error('修改密码错误:', error);
    throw new APIError(
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      i18n.t('common.errors.internalServerError')
    );
  }
}

/**
 * 获取用户邮箱验证状态
 */
export async function getUserEmailStatus(
  userId: number,
  prisma: PrismaClient = defaultPrisma
): Promise<{ isVerified: boolean }> {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { email_verified: true }
    });

    if (!user) {
      throw new APIError(
        404,
        ErrorCodes.USER_NOT_FOUND,
        i18n.t('user.errors.userNotFound')
      );
    }

    return { isVerified: user.email_verified };
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    console.error('获取用户邮箱状态错误:', error);
    throw new APIError(
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      i18n.t('common.errors.internalServerError')
    );
  }
}

/**
 * 生成邮箱验证令牌
 */
export async function generateEmailVerificationToken(
  userId: number,
  prisma: PrismaClient = defaultPrisma
): Promise<{ email: string; token: string }> {
  try {
    // 获取用户邮箱
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user) {
      throw new APIError(404, ErrorCodes.USER_NOT_FOUND, i18n.t('user.errors.userNotFound'));
    }

    // 生成随机令牌
    const token = crypto.randomBytes(32).toString('hex');

    // 保存验证令牌
    await prisma.email_Verifications.create({
      data: {
        user_id: userId,
        token,
        expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS)
      }
    });

    return { email: user.email, token };
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    console.error('生成邮箱验证令牌错误:', error);
    throw new APIError(
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      i18n.t('common.errors.internalServerError')
    );
  }
}