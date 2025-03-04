import nodemailer from 'nodemailer';
import { env } from '../env';
import i18n from '@/i18n';
import { ErrorCodes } from '@/types/api';
import { APIError } from '../middleware/errorHandler';

// 创建邮件传输器
const transporter = nodemailer.createTransport({
  host: env.MAIL_SERVER,
  port: env.MAIL_PORT,
  secure: env.MAIL_SSL_TLS,
  auth: {
    user: env.MAIL_USERNAME,
    pass: env.MAIL_PASSWORD
  },
  tls: {
    ciphers: 'SSLv3'
  }
});

/**
 * 发送验证邮件
 */
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verificationLink = `${env.BASE_URL}/api/v1/public/verify-email?token=${token}`;
  
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to: email,
    subject: i18n.t('auth.email.verification.subject'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${i18n.t('auth.email.verification.greeting')}</h2>
        <p>${i18n.t('auth.email.verification.message')}</p>
        <p>
          <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
            ${i18n.t('auth.email.verification.action')}
          </a>
        </p>
        <p>${i18n.t('auth.email.verification.fallback')}</p>
        <p>${verificationLink}</p>
        <p>${i18n.t('auth.email.verification.expiry')}</p>
      </div>
    `
  });
}

/**
 * 发送密码重置邮件
 * @param email 用户邮箱
 * @param token 重置令牌
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetLink = `${env.BASE_URL}/api/v1/public/reset-password?token=${token}`;
  
  try {
    await transporter.sendMail({
      from: env.MAIL_FROM,
      to: email,
      subject: i18n.t('auth.email.resetPassword.subject'),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${i18n.t('auth.email.resetPassword.greeting')}</h2>
          <p>${i18n.t('auth.email.resetPassword.message')}</p>
          <p>
            <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
              ${i18n.t('auth.email.resetPassword.action')}
            </a>
          </p>
          <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
          <p>${resetLink}</p>
          <p>${i18n.t('auth.email.resetPassword.expiry')}</p>
          <p>${i18n.t('auth.email.resetPassword.footer')}</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new APIError(
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      i18n.t('auth.errors.resetEmailFailed')
    );
  }
}

/**
 * 发送安全通知邮件
 */
export async function sendSecurityNotificationEmail(email: string, action: string, location: string): Promise<void> {
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to: email,
    subject: i18n.t('auth.email.security.subject'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${i18n.t('auth.email.security.greeting')}</h2>
        <p>${i18n.t('auth.email.security.activityDetected', { action })}</p>
        <p>${i18n.t('auth.email.security.location', { location })}</p>
        <p>${i18n.t('auth.email.security.time', { time: new Date().toLocaleString(i18n.language) })}</p>
        <p>${i18n.t('auth.email.security.warning')}</p>
      </div>
    `
  });
}