/**
 * 通用 API 响应类型
 * @template T 响应数据类型
 */
export type APIResponse<T> = {
  /** 请求状态 */
  status: 'success' | 'error';
  /** 响应数据 */
  data: T | null;
  /** 响应消息 */
  message: string;
  /** 错误码 */
  code?: ErrorCodes;
};

/**
 * API 错误码枚举
 */
export enum ErrorCodes {
  // 认证相关
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // 注册相关
  REG_USERNAME_EXISTS = 'REG_USERNAME_EXISTS',
  REG_EMAIL_EXISTS = 'REG_EMAIL_EXISTS',
  INVALID_PASSWORD = 'INVALID_PASSWORD',

  // 2FA 相关
  INVALID_2FA_CODE = 'INVALID_2FA_CODE',
  TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED',
  TWO_FACTOR_ALREADY_ENABLED = '2FA_ALREADY_ENABLED',

  // 用户相关
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',

  // SSO 相关
  INVALID_PROVIDER = 'INVALID_PROVIDER',
  SSO_ERROR = 'SSO_ERROR',
  INVALID_SSO_CODE = 'INVALID_SSO_CODE',

  // 速率限制
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // 其他
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  INVALID_STATE = 'INVALID_STATE',
  INCORRECT_PASSWORD = 'INCORRECT_PASSWORD',

  // 邮箱验证相关
  EMAIL_ALREADY_VERIFIED = 'EMAIL_ALREADY_VERIFIED',
  INVALID_CODE = 'INVALID_CODE',
  INVALID_VERIFICATION_CODE = 'INVALID_VERIFICATION_CODE',
  VERIFICATION_CODE_EXPIRED = 'VERIFICATION_CODE_EXPIRED',

  // 服务相关
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // 认证相关
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_RESET_TOKEN = 'INVALID_RESET_TOKEN',
  RESET_PASSWORD_FAILED = 'RESET_PASSWORD_FAILED',

  // 验证相关
  INVALID_USERNAME = 'INVALID_USERNAME',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_INPUT = 'INVALID_INPUT',
}

// ===================== 密码重置相关 =====================

/**
 * 密码重置请求
 */
export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

// ===================== 邮箱验证相关 =====================

/**
 * 邮箱验证请求
 */
export interface EmailVerificationRequest {
  code: string;
}

/**
 * 邮箱验证响应
 */
export interface EmailVerificationResponse {
  is_email_verified: boolean;
}

// ===================== 2FA 相关 =====================

/**
 * 2FA 设置数据
 */
export interface TwoFactorSetupData {
  secret: string;
  qr_code_url: string;
  backup_codes: string[];
}

/**
 * 2FA 验证请求
 */
export interface TwoFactorVerifyRequest {
  code: string;
}

/**
 * 2FA 验证响应
 */
export interface TwoFactorVerifyResponse {
  two_factor_enabled: boolean;
}

// ===================== SSO 相关 =====================

/**
 * SSO 提供商类型
 */
export type SSOProvider = 'google' | 'github';

/**
 * SSO 回调请求
 */
export interface SSOCallbackRequest {
  code: string;
  state: string;
}

/**
 * SSO 回调响应数据，扩展自登录数据
 */
export interface SSOCallbackData extends LoginData {
  user: {
    username: string;
    email: string;
  };
}

// ===================== 用户相关 =====================

/**
 * 用户信息
 */
export interface UserInfo {
  username: string;
  email: string;
  roles: string[];
  is_email_verified: boolean;
  two_factor_enabled: boolean;
}

/**
 * 修改密码请求
 */
export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

// ===================== 认证相关 =====================

/**
 * 用户注册请求参数
 */
export interface RegisterRequest {
  /** 用户名 (3-50字符，仅字母、数字、下划线) */
  username: string;
  /** 邮箱地址 (最大255字符，符合RFC 5322) */
  email: string;
  /** 密码 (最少8字符，包含大小写字母和数字) */
  password: string;
}

/**
 * 用户注册响应数据
 */
export interface RegisterResponse {
  /** 用户ID */
  user_id: string;
  /** 用户名 */
  username: string;
  /** 邮箱地址 */
  email: string;
}

/**
 * 用户登录请求
 */
export interface LoginRequest {
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** 两步验证码（可选） */
  two_factor_code?: string;
}

/**
 * 登录响应数据
 */
export interface LoginData {
  /** JWT访问令牌 */
  access_token: string;
  /** 令牌类型 */
  token_type: 'bearer';
  /** 刷新令牌 */
  refresh_token: string;
  /** 访问令牌过期时间（秒） */
  expires_in: number;
  /** 是否需要两步验证 */
  requires2FA?: boolean;
  /** 用户信息 */
  user?: {
    username: string | null;
    email: string;
  };
}

/**
 * 用户登录响应
 */
export type LoginResponse = APIResponse<LoginData>;

/**
 * 登出请求
 */
export interface LogoutRequest {
  /** 刷新令牌（可选，如果提供则同时使该刷新令牌失效） */
  refresh_token?: string;
}

/**
 * 登出响应数据
 */
export interface LogoutData {
  /** 登出是否成功 */
  success: boolean;
}

// ===================== 系统状态相关 =====================

/**
 * 健康检查响应数据
 */
export interface HealthCheckData {
  /** 整体状态 */
  overall: 'healthy' | 'unhealthy';
  /** 数据库状态 */
  database: 'connected' | 'disconnected';
  /** 缓存状态 */
  cache: 'connected' | 'disconnected';
  /** 检查时间戳 */
  timestamp: string;
}

/**
 * 健康检查响应
 */
export type HealthCheckResponse = APIResponse<HealthCheckData>;

// ===================== 忘记密码/刷新令牌相关 =====================

/**
 * 忘记密码请求
 */
export interface ForgotPasswordRequest {
  /** 邮箱地址 (符合RFC 5322) */
  email: string;
}

/**
 * 刷新令牌请求
 */
export interface RefreshTokenRequest {
  /** 刷新令牌 (32-128字符) */
  refresh_token: string;
}
