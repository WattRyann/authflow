// @/utils/crypto.ts
import crypto from 'crypto';

// 从环境变量获取密钥（32 字节，64 个十六进制字符）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be 64 characters (32 bytes)');
}
const KEY = Buffer.from(ENCRYPTION_KEY, 'hex');

// 加密函数
export function encrypt(text: string): string {
  // 生成随机 12 字节 IV
  const iv = crypto.randomBytes(12);
  // 创建 AES-256-GCM 加密器
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);

  // 加密明文
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // 获取认证标签
  const tag = cipher.getAuthTag().toString('hex');

  // 组合 IV、密文和 tag，用冒号分隔
  const encryptedData = `${iv.toString('hex')}:${encrypted}:${tag}`;

  // 返回 Base64 编码结果
  return Buffer.from(encryptedData).toString('base64');
}

// 解密函数
export function decrypt(encryptedData: string): string {
  // 解码 Base64 并分割为 IV、密文和 tag
  const [ivHex, encryptedHex, tagHex] = Buffer.from(encryptedData, 'base64')
    .toString('utf8')
    .split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  // 创建 AES-256-GCM 解密器
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);

  // 解密密文
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  // 返回明文
  return decrypted;
}