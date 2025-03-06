import { z } from 'zod';
import { config } from 'dotenv';

config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  // SECRET_KEY: z.string().min(32),
  // REFRESH_SECRET_KEY: z.string().min(32),
  ALGORITHM: z.enum(['HS256', 'HS384', 'HS512']),
  // 邮件配置
  MAIL_USERNAME: z.string().email(),
  MAIL_PASSWORD: z.string(),
  MAIL_FROM: z.string().email(),
  MAIL_PORT: z.coerce.number().int().positive(),
  MAIL_SERVER: z.string(),
  MAIL_SSL_TLS: z.coerce.boolean(),
  MAIL_STARTTLS: z.coerce.boolean(),
  MAIL_USE_CREDENTIALS: z.coerce.boolean(),
  // 验证码配置
  VERIFICATION_CODE_LENGTH: z.coerce.number().int().min(6).max(8),
  VERIFICATION_CODE_EXPIRE_MINUTES: z.coerce.number().int().positive(),
  // Redis配置
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string(),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_DB: z.coerce.number().int().min(0),

  // OAuth配置
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),

  // 应用配置
  BASE_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string()
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
