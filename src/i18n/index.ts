// 简化版 i18n 模块，不依赖 React
import i18next from 'i18next';

// 初始化 i18next，但不使用 initReactI18next
i18next.init({
  fallbackLng: 'zh',
  lng: 'zh', // 默认语言
  interpolation: {
    escapeValue: false,
  },
  resources: {
    en: {
      auth: {
        errors: {
          invalidUsername: "Username must be 3-50 characters and can only contain letters, numbers, and underscores",
          invalidEmail: "Invalid email format",
          invalidPassword: "Password must be at least 8 characters long, including uppercase, lowercase letters and numbers",
          usernameExists: "Username already exists",
          emailExists: "Email already registered",
          registrationFailed: "Registration failed, please try again later",
          rateLimitExceeded: "Too many requests, please try again later",
          resetEmailSent: "If the email exists, a password reset link has been sent",
          invalidResetToken: "Invalid or expired reset token",
          resetPasswordFailed: "Failed to reset password, please try again later",
          invalidCredentials: 'Invalid username or password',
          twoFactorRequired: 'Two-factor authentication is required',
          invalid2FACode: 'Invalid two-factor authentication code',
          loginFailed: 'Login failed, please try again later',
          unauthorized: 'Unauthorized access',
          invalidToken: 'Invalid token',
          internalServerError: 'Internal server error'
        },
        messages: {
          passwordResetSuccess: "Password has been reset successfully",
          logoutSuccess: "Logout successful"
        },
        success: {
          registration: "Registration successful"
        }
      },
      common: {
        validation: {
          required: "{{field}} is required",
          minLength: "{{field}} must be at least {{min}} characters",
          maxLength: "{{field}} cannot exceed {{max}} characters"
        },
        errors: {
          internalServerError: "Internal server error"
        }
      },
      email: {
        verification: {
          subject: 'Verify Your Email',
          greeting: 'Verify Your Email Address',
          message: 'Please click the link below to verify your email address:',
          action: 'Verify Email',
          fallback: 'If the button does not work, please copy and paste the following link in your browser:',
          expiry: 'This link will expire in 24 hours.'
        },
        resetPassword: {
          subject: 'Reset Your Password',
          greeting: 'Password Reset Request',
          message: 'We received a request to reset your password. Click the button below to proceed:',
          action: 'Reset Password',
          expiry: 'This link will expire in 24 hours.',
          footer: 'If you did not request this password reset, please ignore this email.'
        },
        security: {
          subject: 'Security Alert',
          greeting: 'Security Alert',
          activityDetected: 'We detected new {{action}} activity on your account:',
          location: 'Location: {{location}}',
          time: 'Time: {{time}}',
          warning: 'If this was not you, please change your password immediately and contact support.'
        }
      }
    },
    zh: {
      auth: {
        errors: {
          invalidUsername: "用户名必须是3-50字符，且只能包含字母、数字和下划线",
          invalidEmail: "邮箱格式不正确",
          invalidPassword: "密码必须至少8个字符，包含大小写字母和数字",
          usernameExists: "用户名已存在",
          emailExists: "邮箱已注册",
          registrationFailed: "注册失败，请稍后重试",
          rateLimitExceeded: "请求过于频繁，请稍后再试",
          resetEmailSent: "如果邮箱存在，重置密码邮件已发送",
          invalidResetToken: "重置令牌无效或已过期",
          resetPasswordFailed: "密码重置失败，请稍后重试",
          invalidCredentials: '用户名或密码错误',
          twoFactorRequired: '需要两步验证码',
          invalid2FACode: '无效的两步验证码',
          loginFailed: '登录失败，请稍后重试',
          unauthorized: '未授权访问',
          invalidToken: '无效的令牌',
          internalServerError: '服务器内部错误'
        },
        messages: {
          passwordResetSuccess: "密码重置成功",
          logoutSuccess: "登出成功"
        },
        success: {
          registration: "注册成功"
        }
      },
      common: {
        validation: {
          required: "{{field}}不能为空",
          minLength: "{{field}}至少需要{{min}}个字符",
          maxLength: "{{field}}不能超过{{max}}个字符"
        },
        errors: {
          internalServerError: "服务器内部错误"
        }
      },
      email: {
        verification: {
          subject: '验证您的邮箱',
          greeting: '验证您的邮箱地址',
          message: '请点击以下链接验证您的邮箱地址：',
          action: '验证邮箱',
          fallback: '如果按钮无法点击，请复制以下链接到浏览器：',
          expiry: '此链接将在24小时后失效。'
        },
        resetPassword: {
          subject: '重置您的密码',
          greeting: '密码重置请求',
          message: '我们收到了重置密码的请求。点击下面的按钮继续：',
          action: '重置密码',
          expiry: '此链接将在24小时后失效。',
          footer: '如果这不是您发起的密码重置请求，请忽略此邮件。'
        },
        security: {
          subject: '安全提醒',
          greeting: '安全提醒',
          activityDetected: '我们检测到您的账户有新的{{action}}活动：',
          location: '地点：{{location}}',
          time: '时间：{{time}}',
          warning: '如果这不是您的操作，请立即修改密码并联系客服。'
        }
      }
    }
  }
});

// 导出简化的 i18n 接口
// 定义 i18n 接口类型
interface I18n {
  t(key: string, options?: Record<string, unknown>): string;
  changeLanguage(lng: string): void;
  language: string; // 添加 language 属性
}

// 创建命名的 i18n 对象
const i18n: I18n = {
  t(key: string, options?: Record<string, unknown>): string {
    // 确保返回的是字符串类型
    const translation = i18next.t(key, options);
    return typeof translation === 'string' ? translation : key;
  },
  changeLanguage(lng: string): void {
    i18next.changeLanguage(lng);
  },
  // 添加 language 属性的 getter
  get language(): string {
    return i18next.language;
  }
};

// 导出命名的对象
export default i18n;