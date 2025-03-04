# 认证 API 文档

本文档描述了一个模块化、安全且符合 RESTful 原则的认证系统，所有端点均位于 `/api/v1` 下。接口分为公共端点（`/public`）、认证管理（`/auth`）、用户资源（`/users`）、两步验证（`/2fa`）、单点登录（`/sso`）和健康检查（`/health`）。文档提供了版本管理说明、安全建议、字段数据字典、调用示例及完整的 HTTP 状态码说明，旨在为开发者提供一致、易用且安全的 API 接入指南。

---

## 版本管理说明
- **当前版本**：v1，所有 URL 以 `/api/v1` 开头。
- **向后兼容性**：非破坏性更新将新增端点或扩展字段，保持现有功能兼容；重大更改或功能移除将发布新版本（如 `/api/v2`）。
- **版本控制策略**：建议在请求 URL 中指定版本，并订阅变更日志以获取更新通知。

---

## 安全性说明
- **HTTPS**：所有请求必须通过 HTTPS，确保数据加密传输。
- **CORS 策略**：配置跨域资源共享（CORS），仅允许受信任的域名访问。
- **身份验证**：受保护端点需包含 `Authorization: Bearer <token>` 请求头，系统验证 token 有效性及黑名单状态。
- **API 密钥/客户端凭证**：建议第三方集成使用 API 密钥或 OAuth 客户端凭证增强访问控制。
- **速率限制**：各端点设置速率限制以防滥用，具体限制见端点说明。
- **令牌黑名单**：登出或刷新时失效的令牌加入黑名单（存储如 Redis），直至过期。

---

## 字段数据字典
- `status` (字符串): 请求结果，值包括 `"success"` 或 `"error"`。
- `data` (对象或 null): 成功时的响应数据或错误时的详细信息。
- `message` (字符串): 请求结果的简要描述，支持国际化。
- `code` (字符串, 可选): 错误时的具体错误码，用于调试和日志。
- `timestamp` (字符串, ISO 8601 格式, 可选): 响应生成时间，仅在健康检查中返回。

---

## HTTP 状态码说明

| HTTP 状态码 | 含义                | 适用场景                          |
|-------------|---------------------|-----------------------------------|
| 200         | OK                  | 请求成功，返回预期结果            |
| 201         | Created             | 资源创建成功（如注册用户）        |
| 302         | Found               | 重定向（如 SSO 登录发起）         |
| 400         | Bad Request         | 参数错误或格式不正确              |
| 401         | Unauthorized        | 未授权（如 token 无效或黑名单）   |
| 403         | Forbidden           | 权限不足                          |
| 429         | Too Many Requests   | 请求频率超限                      |
| 503         | Service Unavailable | 服务不可用（如数据库故障）        |

---

## 公共端点（无需认证）

### 1. 用户注册
- **端点**: `POST /api/v1/public/register`
- **描述**: 创建新用户账户。
- **请求参数**:
  - `username` (字符串, 3-50 字符, 仅字母、数字、下划线): 唯一用户名。
  - `email` (字符串, 最大 255 字符, RFC 5322 格式): 用户邮箱。
  - `password` (字符串, 最小 8 字符, 含 1 大写、1 小写、1 数字): 用户密码。
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": {
      "user_id": "123",
      "username": "johndoe",
      "email": "john@example.com"
    },
    "message": "User registered successfully"
  }
  ```
- **错误响应**:
  - `HTTP 400`: 用户名/邮箱已存在或格式错误。
    ```json
    {
      "status": "error",
      "data": {"field": "email", "reason": "Email already registered"},
      "message": "Registration failed",
      "code": "REG_EMAIL_EXISTS"
    }
    ```
  - `HTTP 429`: 速率超限（10 次/IP/分钟）。
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Too many requests",
      "code": "RATE_LIMIT_EXCEEDED"
    }
    ```
- **速率限制**: 10 次/IP/分钟。
- **调用示例**:
  ```bash
  curl -X POST https://api.example.com/api/v1/public/register \
    -H "Content-Type: application/json" \
    -d '{"username": "johndoe", "email": "john@example.com", "password": "Password123"}'
  ```

---

### 2. 忘记密码
- **端点**: `POST /api/v1/public/forgot-password`
- **描述**: 发送密码重置邮件。
- **请求参数**:
  - `email` (字符串, 最大 255 字符, RFC 5322 格式): 用户邮箱。
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": null,
    "message": "Password reset email sent"
  }
  ```
- **错误响应**:
  - `HTTP 429`: 速率超限（3 次/邮箱/小时）。
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Too many requests",
      "code": "RATE_LIMIT_EXCEEDED"
    }
    ```
- **速率限制**: 3 次/邮箱/小时。
- **调用示例**:
  ```bash
  curl -X POST https://api.example.com/api/v1/public/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email": "john@example.com"}'
  ```

---

### 3. 重置密码
- **端点**: `POST /api/v1/public/reset-password`
- **描述**: 使用重置令牌更新密码。
- **请求参数**:
  - `token` (字符串, 32-64 字符): 重置令牌。
  - `new_password` (字符串, 最小 8 字符, 含 1 大写、1 小写、1 数字): 新密码。
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": null,
    "message": "Password reset successfully"
  }
  ```
- **错误响应**:
  - `HTTP 400`: 密码格式错误。
    ```json
    {
      "status": "error",
      "data": {"field": "new_password", "reason": "Password must include uppercase, lowercase, and digit"},
      "message": "Invalid password",
      "code": "INVALID_PASSWORD"
    }
    ```
  - `HTTP 401`: 令牌无效或过期。
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Invalid or expired reset token",
      "code": "INVALID_RESET_TOKEN"
    }
    ```
  - `HTTP 429`: 速率超限（5 次/令牌/小时）。
- **速率限制**: 5 次/令牌/小时。
- **调用示例**:
  ```bash
  curl -X POST https://api.example.com/api/v1/public/reset-password \
    -H "Content-Type: application/json" \
    -d '{"token": "resetToken123", "new_password": "NewPass123"}'
  ```

---

## 认证端点（令牌管理）

### 4. 用户登录
- **端点**: `POST /api/v1/auth/login`
- **描述**: 验证用户身份并颁发令牌，支持可选 2FA。
- **请求参数**:
  - `username` (字符串, 3-50 字符, 仅字母、数字、下划线): 用户名。
  - `password` (字符串): 密码。
  - `two_factor_code` (字符串, 6 位数字, 可选): 启用 2FA 时必填。
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": {
      "access_token": "xyz",
      "token_type": "bearer",
      "refresh_token": "abc",
      "expires_in": 3600
    },
    "message": "Login successful"
  }
  ```
- **错误响应**:
  - `HTTP 401`: 凭证或 2FA 错误。
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Invalid username, password, or 2FA code",
      "code": "INVALID_CREDENTIALS"
    }
    ```
  - `HTTP 429`: 速率超限（5 次失败/用户名/IP/15 分钟）。
- **速率限制**: 5 次失败/用户名/IP/15 分钟。
- **调用示例**:
  ```bash
  curl -X POST https://api.example.com/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username": "johndoe", "password": "Password123", "two_factor_code": "123456"}'
  ```

---

### 5. 刷新访问令牌
- **端点**: `POST /api/v1/auth/token/refresh`
- **描述**: 使用刷新令牌获取新访问令牌。
- **请求参数**:
  - `refresh_token` (字符串, 32-128 字符): 刷新令牌。
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": {
      "access_token": "new_xyz",
      "token_type": "bearer",
      "refresh_token": "new_abc",
      "expires_in": 3600
    },
    "message": "Token refreshed successfully"
  }
  ```
- **错误响应**:
  - `HTTP 401`: 刷新令牌无效或黑名单。
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Invalid or expired refresh token",
      "code": "INVALID_REFRESH_TOKEN"
    }
    ```
  - `HTTP 429`: 速率超限（20 次/用户/小时）。
- **速率限制**: 20 次/用户/小时。
- **调用示例**:
  ```bash
  curl -X POST https://api.example.com/api/v1/auth/token/refresh \
    -H "Content-Type: application/json" \
    -d '{"refresh_token": "abc"}'
  ```

---

### 6. 登出
- **端点**: `POST /api/v1/auth/logout`
- **描述**: 失效当前访问和刷新令牌。
- **请求头**: `Authorization: Bearer <token>`
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": null,
    "message": "Logged out successfully"
  }
  ```
- **错误响应**:
  - `HTTP 401`: 令牌无效或已黑名单。
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Invalid or already logged out",
      "code": "INVALID_TOKEN"
    }
    ```
- **令牌黑名单**: 添加至黑名单。
- **调用示例**:
  ```bash
  curl -X POST https://api.example.com/api/v1/auth/logout \
    -H "Authorization: Bearer xyz"
  ```

---

## 用户资源端点（需要认证）

### 7. 获取当前用户信息
- **端点**: `GET /api/v1/users/me`
- **描述**: 获取已认证用户的信息。
- **请求头**: `Authorization: Bearer <token>`
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": {
      "username": "johndoe",
      "email": "john@example.com",
      "roles": ["user"],
      "is_email_verified": false,
      "two_factor_enabled": false
    },
    "message": "User info retrieved successfully"
  }
  ```
- **错误响应**:
  - `HTTP 401`: 令牌无效或黑名单。
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Unauthorized",
      "code": "UNAUTHORIZED"
    }
    ```
- **调用示例**:
  ```bash
  curl -X GET https://api.example.com/api/v1/users/me \
    -H "Authorization: Bearer xyz"
  ```

---

### 8. 修改密码
- **端点**: `PATCH /api/v1/users/me/password`
- **描述**: 更新用户密码。
- **请求头**: `Authorization: Bearer <token>`
- **请求参数**:
  - `old_password` (字符串): 当前密码。
  - `new_password` (字符串, 最小 8 字符, 含 1 大写、1 小写、1 数字): 新密码。
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": null,
    "message": "Password updated successfully"
  }
  ```
- **错误响应**:
  - `HTTP 400`: 新密码格式错误。
    ```json
    {
      "status": "error",
      "data": {"field": "new_password", "reason": "Password must include uppercase, lowercase, and digit"},
      "message": "Invalid password",
      "code": "INVALID_PASSWORD"
    }
    ```
  - `HTTP 401`: 旧密码错误或令牌无效。
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Incorrect old password",
      "code": "INCORRECT_PASSWORD"
    }
    ```
  - `HTTP 429`: 速率超限（5 次/用户/小时）。
- **速率限制**: 5 次/用户/小时。
- **调用示例**:
  ```bash
  curl -X PATCH https://api.example.com/api/v1/users/me/password \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer xyz" \
    -d '{"old_password": "Password123", "new_password": "NewPass123"}'
  ```

---

### 9. 发送邮箱验证邮件
- **端点**: `POST /api/v1/users/me/verify-email/send`
- **描述**: 发送邮箱验证代码。
- **请求头**: `Authorization: Bearer <token>`
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": null,
    "message": "Verification email sent"
  }
  ```
- **错误响应**:
  - `HTTP 400`: 邮箱已验证。
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Email already verified",
      "code": "EMAIL_ALREADY_VERIFIED"
    }
    ```
  - `HTTP 401`: 令牌无效。
  - `HTTP 429`: 速率超限（3 次/用户/天）。
- **速率限制**: 3 次/用户/天。
- **调用示例**:
  ```bash
  curl -X POST https://api.example.com/api/v1/users/me/verify-email/send \
    -H "Authorization: Bearer xyz"
  ```

---

### 10. 验证邮箱
- **端点**: `PATCH /api/v1/users/me/verify-email`
- **描述**: 使用验证码验证邮箱。
- **请求头**: `Authorization: Bearer <token>`
- **请求参数**:
  - `code` (字符串, 6 字符): 邮箱验证码。
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": {
      "is_email_verified": true
    },
    "message": "Email verified successfully"
  }
  ```
- **错误响应**:
  - `HTTP 400`: 验证码无效或邮箱已验证。
    ```json
    {
      "status": "error",
      "data": {"field": "code", "reason": "Invalid or expired code"},
      "message": "Verification failed",
      "code": "INVALID_CODE"
    }
    ```
  - `HTTP 401`: 令牌无效。
  - `HTTP 429`: 速率超限（10 次/用户/小时）。
- **速率限制**: 10 次/用户/小时。
- **调用示例**:
  ```bash
  curl -X PATCH https://api.example.com/api/v1/users/me/verify-email \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer xyz" \
    -d '{"code": "ABC123"}'
  ```

---

## 两步验证（2FA）端点（需要认证）

### 11. 启用 2FA
- **端点**: `POST /api/v1/2fa/enable`
- **描述**: 发起 2FA 设置，返回密钥、二维码和备用码。
- **请求头**: `Authorization: Bearer <token>`
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": {
      "secret": "JBSWY3DPEHPK3PXP",
      "qr_code_url": "https://example.com/qr/123",
      "backup_codes": ["12345678", "87654321"]
    },
    "message": "2FA setup initiated, verify to activate"
  }
  ```
- **错误响应**:
  - `HTTP 400`: 2FA 已启用。
    ```json
    {
      "status": "error",
      "data": null,
      "message": "2FA already enabled",
      "code": "2FA_ALREADY_ENABLED"
    }
    ```
  - `HTTP 401`: 令牌无效。
  - `HTTP 429`: 速率超限（3 次/用户/天）。
- **速率限制**: 3 次/用户/天。
- **调用示例**:
  ```bash
  curl -X POST https://api.example.com/api/v1/2fa/enable \
    -H "Authorization: Bearer xyz"
  ```

---

### 12. 验证 2FA 设置
- **端点**: `POST /api/v1/2fa/verify`
- **描述**: 激活 2FA。
- **请求头**: `Authorization: Bearer <token>`
- **请求参数**:
  - `code` (字符串, 6 位数字): 认证应用生成的验证码。
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": {
      "two_factor_enabled": true
    },
    "message": "2FA activated successfully"
  }
  ```
- **错误响应**:
  - `HTTP 400`: 验证码无效。
    ```json
    {
      "status": "error",
      "data": {"field": "code", "reason": "Invalid 2FA code"},
      "message": "Verification failed",
      "code": "INVALID_2FA_CODE"
    }
    ```
  - `HTTP 401`: 令牌无效。
  - `HTTP 429`: 速率超限（10 次/用户/小时）。
- **速率限制**: 10 次/用户/小时。
- **调用示例**:
  ```bash
  curl -X POST https://api.example.com/api/v1/2fa/verify \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer xyz" \
    -d '{"code": "654321"}'
  ```

---

## 单点登录（SSO）端点（混合访问）

### 13. SSO 登录发起
- **端点**: `GET /api/v1/sso/{provider}`
- **描述**: 发起 SSO 登录，重定向至提供商授权页面。
- **请求参数**:
  - `provider` (路径参数, 枚举: "google", "github", 等): SSO 提供商。
- **返回**: HTTP 302 重定向至提供商授权 URL。
- **错误响应**:
  - `HTTP 400`: 不支持的提供商。
    ```json
    {
      "status": "error",
      "data": {"field": "provider", "reason": "Unsupported provider"},
      "message": "Invalid provider",
      "code": "INVALID_PROVIDER"
    }
    ```
  - `HTTP 429`: 速率超限（10 次/IP/分钟）。
- **速率限制**: 10 次/IP/分钟。
- **调用示例**:
  ```bash
  # 浏览器访问
  https://api.example.com/api/v1/sso/google
  ```

---

### 14. SSO 回调
- **端点**: `GET /api/v1/sso/{provider}/callback`
- **描述**: 处理 SSO 回调，颁发令牌和用户信息。
- **请求参数**:
  - `provider` (路径参数, 枚举: "google", "github", 等): SSO 提供商。
  - `code` (查询参数, 字符串): 授权码。
  - `state` (查询参数, 字符串): CSRF 状态参数。
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": {
      "access_token": "xyz",
      "token_type": "bearer",
      "refresh_token": "abc",
      "expires_in": 3600,
      "user": {
        "username": "johndoe",
        "email": "john@example.com"
      }
    },
    "message": "SSO login successful"
  }
  ```
- **错误响应**:
  - `HTTP 400`: 授权码或 state 无效。
    ```json
    {
      "status": "error",
      "data": {"field": "code", "reason": "Invalid authorization code"},
      "message": "SSO login failed",
      "code": "INVALID_SSO_CODE"
    }
    ```
  - `HTTP 429`: 速率超限（10 次/IP/分钟）。
- **速率限制**: 10 次/IP/分钟。
- **调用示例**:
  ```bash
  curl -X GET "https://api.example.com/api/v1/sso/google/callback?code=authCode&state=csrfState"
  ```

---

## 健康检查端点

### 15. 健康检查
- **端点**: `GET /api/v1/health`
- **描述**: 检查服务及其依赖的健康状况。
- **请求参数**: 无。
- **返回示例**:
  ```json
  {
    "status": "success",
    "data": {
      "overall": "healthy",
      "database": "ok",
      "cache": "ok"
    },
    "message": "Service is operational",
    "timestamp": "2025-02-25T10:00:00Z"
  }
  ```
- **错误响应**:
  - `HTTP 503`: 服务不可用。
    ```json
    {
      "status": "error",
      "data": {"component": "database", "reason": "Connection failed"},
      "message": "Service unavailable",
      "code": "SERVICE_UNAVAILABLE"
    }
    ```
- **调用示例**:
  ```bash
  curl -X GET https://api.example.com/api/v1/health
  ```

---

### 改进
1. **一致性**：确保所有返回结构严格遵循 `{status, data, message, code}`，包括健康检查。
2. **清晰性**：为每个参数添加具体约束（如字符长度、格式），提升文档精度。
3. **安全性**：明确提到 HTTPS、CORS 和 API 密钥建议，强化安全上下文。
4. **调用示例**：为每个端点提供完整的 cURL 示例，便于开发者测试。
5. **状态码**：补充 `201` 和 `302`，覆盖更多场景。
