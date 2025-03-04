import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { APIError } from '@/middleware/errorHandler';
import { ErrorCodes, LoginData } from '@/types/api';
import { generateTokens } from '@/utils/jwt';
import { hashPassword } from '@/utils/bcrypt';
import i18n from '@/i18n';
import defaultPrisma from '@/lib/prisma';

// 支持的SSO提供商列表
const SUPPORTED_PROVIDERS = ['google', 'github'];

// 存储CSRF状态的缓存（在生产环境中应使用Redis等持久化存储）
const stateCache = new Map<string, { provider: string; createdAt: number }>();

// 状态令牌过期时间（10分钟）
const STATE_TOKEN_EXPIRY = 10 * 60 * 1000;

// 定期清理过期的状态令牌
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of stateCache.entries()) {
    if (now - value.createdAt > STATE_TOKEN_EXPIRY) {
      stateCache.delete(key);
    }
  }
}, 60 * 1000); // 每分钟清理一次

/**
 * 获取SSO授权URL
 * 
 * 生成授权URL，用户将被重定向到此URL以开始SSO登录流程。
 * 同时生成并存储CSRF状态令牌，用于验证回调请求。
 * 
 * @param {string} provider - SSO提供商（如'google'、'github'）
 * @returns {object} 包含授权URL和状态令牌的对象
 * @throws {APIError} 当提供商不受支持时抛出错误
 */
export function getSSOAuthorizationUrl(provider: string): { url: string; state: string } {
  // 验证提供商是否受支持
  if (!SUPPORTED_PROVIDERS.includes(provider.toLowerCase())) {
    throw new APIError(
      400,
      ErrorCodes.INVALID_PROVIDER,
      i18n.t('sso.errors.invalidProvider')
    );
  }

  // 生成CSRF状态令牌
  const state = uuidv4();
  
  // 存储状态令牌，用于验证回调
  stateCache.set(state, {
    provider: provider.toLowerCase(),
    createdAt: Date.now()
  });

  // 根据提供商构建授权URL
  let authUrl: string;
  const redirectUri = encodeURIComponent(`${process.env.API_BASE_URL}/api/v1/sso/${provider}/callback`);
  
  switch (provider.toLowerCase()) {
    case 'google':
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&state=${state}`;
      break;
    case 'github':
      authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user:email&state=${state}`;
      break;
    default:
      // 这里不应该到达，因为我们已经验证了提供商
      throw new APIError(
        400,
        ErrorCodes.INVALID_PROVIDER,
        i18n.t('sso.errors.invalidProvider')
      );
  }

  return { url: authUrl, state };
}

/**
 * 处理SSO回调
 * 
 * 验证授权码和状态令牌，从提供商获取用户信息，
 * 创建或更新用户记录，并生成访问令牌。
 * 
 * @param {string} provider - SSO提供商（如'google'、'github'）
 * @param {string} code - 授权码
 * @param {string} state - CSRF状态令牌
 * @param {PrismaClient} prisma - Prisma客户端实例（可选，用于依赖注入）
 * @returns {Promise<LoginData>} 登录数据，包含访问令牌和用户信息
 * @throws {APIError} 当验证失败或处理出错时抛出错误
 */
export async function handleSSOCallback(
  provider: string,
  code: string,
  state: string,
  prisma: PrismaClient = defaultPrisma
): Promise<LoginData> {
  // 验证提供商是否受支持
  if (!SUPPORTED_PROVIDERS.includes(provider.toLowerCase())) {
    throw new APIError(
      400,
      ErrorCodes.INVALID_PROVIDER,
      i18n.t('sso.errors.invalidProvider')
    );
  }

  // 验证状态令牌
  const cachedState = stateCache.get(state);
  if (!cachedState || cachedState.provider !== provider.toLowerCase() || 
      Date.now() - cachedState.createdAt > STATE_TOKEN_EXPIRY) {
    throw new APIError(
      400,
      ErrorCodes.INVALID_SSO_CODE,
      i18n.t('sso.errors.invalidState')
    );
  }

  // 使用后删除状态令牌，防止重放攻击
  stateCache.delete(state);

  try {
    // 根据提供商获取访问令牌
    const tokenResponse = await exchangeCodeForToken(provider, code);
    
    // 使用访问令牌获取用户信息
    const userInfo = await fetchUserInfo(provider, tokenResponse.access_token);
    
    // 查找或创建用户
    let user = await prisma.users.findUnique({
      where: { email: userInfo.email }
    });

    if (!user) {
      // 创建新用户
      // 为SSO用户生成一个随机密码哈希，因为数据库模型要求password_hash字段
      const randomPassword = uuidv4();
      const passwordHash = await hashPassword(randomPassword);
      
      user = await prisma.users.create({
        data: {
          email: userInfo.email,
          username: generateUsername(userInfo),
          password_hash: passwordHash, // 添加必需的password_hash字段
          email_verified: true, // SSO登录的邮箱已经过验证
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    }

    // 记录或更新SSO登录方式
    // 首先查找是否已存在该用户的此提供商登录方式
    const existingLoginMethod = await prisma.login_Methods.findFirst({
      where: {
        user_id: user.id,
        provider: provider.toLowerCase()
      }
    });
    
    if (existingLoginMethod) {
      // 更新现有记录
      await prisma.login_Methods.update({
        where: { id: existingLoginMethod.id },
        data: { provider_user_id: userInfo.id }
      });
    } else {
      // 创建新记录
      await prisma.login_Methods.create({
        data: {
          user_id: user.id,
          provider: provider.toLowerCase(),
          provider_user_id: userInfo.id,
          provider_id: `${provider.toLowerCase()}_${userInfo.id}` // 确保唯一性
        }
      });
    }

    // 生成访问令牌和刷新令牌
    const { accessToken, refreshToken } = await generateTokens(user.id);

    // 返回登录数据
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 3600, // 假设访问令牌有效期为1小时
      user: {
        username: user.username,
        email: user.email
      }
    };
  } catch (error) {
    console.error('SSO callback error:', error);
    throw new APIError(
      400,
      ErrorCodes.SSO_ERROR,
      i18n.t('sso.errors.callbackFailed')
    );
  }
}

/**
 * 使用授权码交换访问令牌
 * 
 * @param {string} provider - SSO提供商
 * @param {string} code - 授权码
 * @returns {Promise<any>} 包含访问令牌的响应
 */
async function exchangeCodeForToken(provider: string, code: string): Promise<any> {
  const redirectUri = `${process.env.API_BASE_URL}/api/v1/sso/${provider}/callback`;
  let tokenUrl: string;
  let body: any;

  switch (provider.toLowerCase()) {
    case 'google':
      tokenUrl = 'https://oauth2.googleapis.com/token';
      body = {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      };
      break;
    case 'github':
      tokenUrl = 'https://github.com/login/oauth/access_token';
      body = {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri
      };
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange code for token: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * 从提供商获取用户信息
 * 
 * @param {string} provider - SSO提供商
 * @param {string} accessToken - 访问令牌
 * @returns {Promise<any>} 用户信息
 */
async function fetchUserInfo(provider: string, accessToken: string): Promise<any> {
  let userInfoUrl: string;
  let headers: HeadersInit = {
    'Authorization': `Bearer ${accessToken}`
  };

  switch (provider.toLowerCase()) {
    case 'google':
      userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
      break;
    case 'github':
      userInfoUrl = 'https://api.github.com/user';
      headers = {
        ...headers,
        'Accept': 'application/vnd.github.v3+json'
      };
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  const response = await fetch(userInfoUrl, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }

  const userInfo = await response.json();

  // 如果是GitHub，可能需要额外获取邮箱
  if (provider.toLowerCase() === 'github' && (!userInfo.email || userInfo.email === '')) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', { headers });
    if (emailsResponse.ok) {
      const emails = await emailsResponse.json();
      const primaryEmail = emails.find((email: any) => email.primary && email.verified);
      if (primaryEmail) {
        userInfo.email = primaryEmail.email;
      }
    }
  }

  return userInfo;
}

/**
 * 根据用户信息生成唯一用户名
 * 
 * @param {any} userInfo - 用户信息
 * @returns {string} 生成的用户名
 */
function generateUsername(userInfo: any): string {
  // 尝试从用户信息中提取用户名
  let username = '';
  
  if (userInfo.login) { // GitHub
    username = userInfo.login;
  } else if (userInfo.name) { // Google或其他
    // 移除空格，转为小写
    username = userInfo.name.replace(/\s+/g, '').toLowerCase();
  } else if (userInfo.email) {
    // 使用邮箱前缀
    username = userInfo.email.split('@')[0];
  }
  
  // 确保用户名符合要求（仅字母、数字、下划线）
  username = username.replace(/[^a-zA-Z0-9_]/g, '');
  
  // 如果用户名为空或太短，添加随机字符
  if (username.length < 3) {
    username += uuidv4().substring(0, 8);
  }
  
  return username;
}