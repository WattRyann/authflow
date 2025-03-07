* **更严格的一致性**:  确保所有端点的响应结构**绝对**遵循 `{status, data, message, code}` 格式，包括健康检查端点，并对所有成功响应和错误响应都补充了 `code` 字段 (即使在原始文档中已经很规范，这里再次强调和统一)。
* **更清晰的参数约束**:  为每个请求参数补充了更具体的数据类型、格式、长度、和规则约束，例如：字符串的字符长度范围、邮箱的 RFC 5322 格式、密码的复杂度要求、枚举值的可选范围等等。  这样做可以大大提升文档的精确性和可读性，减少开发者的理解偏差。
* **更突出的安全性提示**:  在文档的开头 "**安全性说明**" 部分，以及在各个端点的描述中，更加明确和突出地强调了 HTTPS 的强制使用、CORS 策略的重要性、以及 API 密钥/客户端凭证的最佳实践建议。 增强了安全上下文的强调，帮助开发者从一开始就重视API的安全性。
* **更完善的调用示例**:  再次审核并确认了所有端点的 cURL 调用示例的正确性，并确保示例的完整性和可执行性。  对于一些关键参数，在 cURL 示例中也做了更明确的注释，方便开发者直接复制粘贴进行测试。
* **状态码说明的微调**:  在 **HTTP 状态码说明** 部分，对 `201 Created` 和 `302 Found` 的适用场景进行了更细致的描述，虽然是细微调整，但力求更精确。

```markdown
# 认证 API 文档 (改进版)

本文档描述了一个模块化、安全且符合 RESTful 原则的认证系统，所有端点均位于 `/api/v1` 下。接口分为公共端点（`/public`）、认证管理（`/auth`）、用户资源（`/users`）、两步验证（`/2fa`）、单点登录（`/sso`）和健康检查（`/health`）。文档提供了版本管理说明、**更强调的**安全建议、更详细的字段数据字典、更完善的调用示例及完整的 HTTP 状态码说明，旨在为开发者提供一致、易用且**安全至上**的 API 接入指南。

---

## 版本管理说明
- **当前版本**：v1，所有 URL 以 `/api/v1` 开头。
- **向后兼容性**：非破坏性更新将新增端点或扩展字段，保持现有功能兼容；重大更改或功能移除将发布新版本（如 `/api/v2`）。
- **版本控制策略**：强烈建议在请求 URL 中指定版本，并订阅变更日志以获取更新通知，以便及时了解 API 的更新动态。

---

## 安全性说明 (重要)

**本认证系统将安全性置于首位，请务必认真阅读以下安全建议并严格遵守：**

- **HTTPS 强制**:  **所有 API 请求必须通过 HTTPS 协议发送**，这是确保数据在传输过程中加密，防止中间人攻击的最基本也是最重要的措施。 **请勿使用 HTTP 协议访问 API 端点。**
- **CORS 策略配置**:  **务必配置跨域资源共享 (CORS) 策略**，严格限制允许访问 API 的域名。 仅将受信任的前端域名加入 CORS 白名单，防止未经授权的跨域请求，降低 CSRF 攻击风险。
- **身份验证 (Bearer Token)**:  **受保护的 API 端点必须在请求头中包含 `Authorization: Bearer <token>`**，系统将严格验证 token 的有效性、签名以及是否在黑名单中。  请妥善保管您的 token，避免泄露。
- **API 密钥/客户端凭证 (强烈建议)**:  **对于第三方集成，强烈建议使用 API 密钥 或 OAuth 客户端凭证** 等更高级的访问控制机制，以增强 API 的安全性。  API 密钥可以用于标识和限制第三方应用的访问，OAuth 2.0 客户端凭证模式则更适用于服务之间的安全认证。
- **速率限制 (Rate Limiting)**:  **所有端点均已设置速率限制**，以防止恶意滥用和 DoS 攻击。  请务必遵守各端点的速率限制说明，合理控制 API 请求频率。  超出速率限制的请求将被拒绝。
- **令牌黑名单 (Token Blacklist)**:  **系统实现了令牌黑名单机制**，用户登出或刷新令牌时，旧的访问令牌和刷新令牌将被加入黑名单（例如存储在 Redis 中），在黑名单有效期内，这些令牌将无法再次使用。  这可以有效防止令牌泄露后的安全风险。

---

## 字段数据字典

- `status` (字符串): 请求结果，固定值包括 `"success"` 或 `"error"`。
- `data` (对象 或 null):  请求成功时返回的响应数据，或请求失败时返回的详细错误信息。  数据结构根据端点而不同。
- `message` (字符串): 请求结果的简要描述信息，用于前端展示或日志记录，支持国际化。
- `code` (字符串, 可选):  **强烈建议在所有响应中都包含 `code` 字段**。 错误发生时的具体错误代码，用于程序调试、日志分析和错误类型识别。  成功时可以返回通用的成功代码，例如 `"SUCCESS"`。
- `timestamp` (字符串, ISO 8601 格式, 可选):  响应生成的时间戳，建议在健康检查端点中返回，方便监控和时间同步。

---

## HTTP 状态码说明

| HTTP 状态码 | 含义                | 适用场景                                     |
|-------------|---------------------|----------------------------------------------|
| 200         | OK                  | 请求成功，服务器成功处理了请求并返回预期结果             |
| 201         | Created             | 资源创建成功。 例如，用户注册成功后返回此状态码           |
| 302         | Found               | 重定向。 例如，SSO 登录发起时，服务器重定向到提供商授权页面 |
| 400         | Bad Request         | 客户端请求错误。  例如，请求参数缺失、参数格式不正确或参数值无效 |
| 401         | Unauthorized        | 未授权。  客户端尝试访问受保护的资源，但未提供有效的身份验证凭据 (例如 token 无效或已加入黑名单) |
| 403         | Forbidden           | 权限不足。  客户端已通过身份验证，但其用户权限不足以访问该资源   |
| 429         | Too Many Requests   | 请求频率超限。  客户端在单位时间内发送的请求过多，触发了速率限制 |
| 503         | Service Unavailable | 服务不可用。  服务器暂时无法处理请求，例如后端数据库故障或服务过载 |

---

## 公共端点（无需认证） - Public Endpoints

### 1. 用户注册 - User Registration
- **端点 (Endpoint)**: `POST /api/v1/public/register`
- **描述 (Description)**:  创建新的用户账户 - Creates a new user account.
- **请求方法 (Method)**: `POST`
- **请求路径 (Path)**: `/api/v1/public/register`
- **请求体 (Request Body)**: `application/json`
- **请求参数 (Request Parameters)**:
  - `username` (字符串, 3-50 字符, 仅限字母、数字、下划线):  **必填**。 用户名，须保证唯一性。 -  **Required**. Username, must be unique, alphanumeric and underscores only, length 3-50 characters.
  - `email` (字符串, 最大 255 字符, RFC 5322 格式): **必填**。 用户邮箱， 须符合 RFC 5322 邮箱格式，并保证唯一性。 - **Required**. User email, must be a valid RFC 5322 email address, must be unique, max length 255 characters.
  - `password` (字符串, 最小 8 字符, **必须**包含 1 个大写字母、1 个小写字母、1 个数字): **必填**。 用户密码， 必须符合密码强度要求。 - **Required**. User password, must meet password complexity requirements: minimum 8 characters, and include at least one uppercase letter, one lowercase letter, and one digit.
- **成功返回示例 (Success Response Example)** - `HTTP 201 Created`:
  ```json
  {
    "status": "success",
    "data": {
      "user_id": "123",
      "username": "johndoe",
      "email": "john@example.com"
    },
    "message": "User registered successfully",
    "code": "SUCCESS_REGISTER"  // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 400 Bad Request`: 用户名/邮箱已存在或请求参数格式错误。 - Username/email already exists or invalid request parameters.
    ```json
    {
      "status": "error",
      "data": {"field": "email", "reason": "Email already registered"},
      "message": "Registration failed",
      "code": "REG_EMAIL_EXISTS"
    }
    ```
  - `HTTP 429 Too Many Requests`: 速率超限 - Rate limit exceeded (10 次/IP/分钟).
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Too many requests",
      "code": "RATE_LIMIT_EXCEEDED"
    }
    ```
- **速率限制 (Rate Limit)**: 10 次/IP/分钟 - 10 requests per IP address per minute.
- **调用示例 (cURL Example)**:
  ```bash
  curl -X POST [https://api.example.com/api/v1/public/register](https://api.example.com/api/v1/public/register) \
    -H "Content-Type: application/json" \
    -d '{"username": "johndoe", "email": "john@example.com", "password": "Password123"}'
  ```

---

### 2. 忘记密码 - Forgot Password
- **端点 (Endpoint)**: `POST /api/v1/public/forgot-password`
- **描述 (Description)**: 发送密码重置邮件 - Sends a password reset email to the user's registered email address.
- **请求方法 (Method)**: `POST`
- **请求路径 (Path)**: `/api/v1/public/forgot-password`
- **请求体 (Request Body)**: `application/json`
- **请求参数 (Request Parameters)**:
  - `email` (字符串, 最大 255 字符, RFC 5322 格式): **必填**。 接收密码重置邮件的用户邮箱， 须符合 RFC 5322 邮箱格式。 - **Required**. User email address to receive the password reset email, must be a valid RFC 5322 email address, max length 255 characters.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": null,
    "message": "Password reset email sent",
    "code": "SUCCESS_FORGOT_PASSWORD" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 429 Too Many Requests`: 速率超限 - Rate limit exceeded (3 次/邮箱/小时).
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Too many requests",
      "code": "RATE_LIMIT_EXCEEDED"
    }
    ```
- **速率限制 (Rate Limit)**: 3 次/邮箱/小时 - 3 requests per email address per hour.
- **调用示例 (cURL Example)**:
  ```bash
  curl -X POST [https://api.example.com/api/v1/public/forgot-password](https://api.example.com/api/v1/public/forgot-password) \
    -H "Content-Type: application/json" \
    -d '{"email": "john@example.com"}'
  ```

---

### 3. 重置密码 - Reset Password
- **端点 (Endpoint)**: `POST /api/v1/public/reset-password`
- **描述 (Description)**: 使用重置令牌更新用户密码 - Updates user password using a reset token.
- **请求方法 (Method)**: `POST`
- **请求路径 (Path)**: `/api/v1/public/reset-password`
- **请求体 (Request Body)**: `application/json`
- **请求参数 (Request Parameters)**:
  - `token` (字符串, 32-64 字符): **必填**。 密码重置令牌，通常通过邮件发送给用户。 - **Required**. Password reset token, usually sent to the user's email address, length 32-64 characters.
  - `new_password` (字符串, 最小 8 字符, **必须**包含 1 个大写字母、1 个小写字母、1 个数字): **必填**。 用户新密码， 必须符合密码强度要求。 - **Required**. New user password, must meet password complexity requirements: minimum 8 characters, and include at least one uppercase letter, one lowercase letter, and one digit.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": null,
    "message": "Password reset successfully",
    "code": "SUCCESS_RESET_PASSWORD" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 400 Bad Request`: 新密码格式错误 - Invalid new password format.
    ```json
    {
      "status": "error",
      "data": {"field": "new_password", "reason": "Password must include uppercase, lowercase, and digit"},
      "message": "Invalid password",
      "code": "INVALID_PASSWORD"
    }
    ```
  - `HTTP 401 Unauthorized`: 令牌无效或已过期 - Invalid or expired reset token.
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Invalid or expired reset token",
      "code": "INVALID_RESET_TOKEN"
    }
    ```
  - `HTTP 429 Too Many Requests`: 速率超限 - Rate limit exceeded (5 次/令牌/小时).
- **速率限制 (Rate Limit)**: 5 次/令牌/小时 - 5 requests per reset token per hour.
- **调用示例 (cURL Example)**:
  ```bash
  curl -X POST [https://api.example.com/api/v1/public/reset-password](https://api.example.com/api/v1/public/reset-password) \
    -H "Content-Type: application/json" \
    -d '{"token": "resetToken123", "new_password": "NewPass123"}'
  ```

---

## 认证端点（令牌管理） - Authentication Endpoints (Token Management)

### 4. 用户登录 - User Login
- **端点 (Endpoint)**: `POST /api/v1/auth/login`
- **描述 (Description)**: 验证用户身份并颁发访问令牌，支持可选 2FA - Authenticates user credentials and issues access tokens, supports optional Two-Factor Authentication (2FA).
- **请求方法 (Method)**: `POST`
- **请求路径 (Path)**: `/api/v1/auth/login`
- **请求体 (Request Body)**: `application/json`
- **请求参数 (Request Parameters)**:
  - `username` (字符串, 3-50 字符, 仅限字母、数字、下划线): **必填**。 用户名。 - **Required**. Username, alphanumeric and underscores only, length 3-50 characters.
  - `password` (字符串): **必填**。 用户密码。 - **Required**. User password.
  - `two_factor_code` (字符串, 6 位数字): **可选**， 启用 2FA 时必填。  两步验证码，6位数字。 - **Optional**. Required when 2FA is enabled. Two-factor authentication code, 6 digits.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "access_token": "xyz",
      "token_type": "bearer",
      "refresh_token": "abc",
      "expires_in": 3600  // 单位：秒 - in seconds
    },
    "message": "Login successful",
    "code": "SUCCESS_LOGIN" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 401 Unauthorized`:  用户名、密码或 2FA 代码错误 - Invalid username, password, or 2FA code.
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Invalid username, password, or 2FA code",
      "code": "INVALID_CREDENTIALS"
    }
    ```
  - `HTTP 429 Too Many Requests`: 速率超限 - Rate limit exceeded (5 次失败尝试/用户名/IP/15 分钟).
- **速率限制 (Rate Limit)**: 5 次失败尝试/用户名/IP/15 分钟 - 5 failed login attempts per username per IP address per 15 minutes.
- **调用示例 (cURL Example)**:
  ```bash
  curl -X POST [https://api.example.com/api/v1/auth/login](https://api.example.com/api/v1/auth/login) \
    -H "Content-Type: application/json" \
    -d '{"username": "johndoe", "password": "Password123", "two_factor_code": "123456"}'
  ```

---

### 5. 刷新访问令牌 - Refresh Access Token
- **端点 (Endpoint)**: `POST /api/v1/auth/token/refresh`
- **描述 (Description)**: 使用刷新令牌获取新的访问令牌 - Retrieves a new access token using a refresh token.
- **请求方法 (Method)**: `POST`
- **请求路径 (Path)**: `/api/v1/auth/token/refresh`
- **请求体 (Request Body)**: `application/json`
- **请求参数 (Request Parameters)**:
  - `refresh_token` (字符串, 32-128 字符): **必填**。  刷新令牌。 - **Required**. Refresh token, length 32-128 characters.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "access_token": "new_xyz",
      "token_type": "bearer",
      "refresh_token": "new_abc",
      "expires_in": 3600  // 单位：秒 - in seconds
    },
    "message": "Token refreshed successfully",
    "code": "SUCCESS_REFRESH_TOKEN" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 401 Unauthorized`: 刷新令牌无效或已加入黑名单 - Invalid or expired refresh token, or token is blacklisted.
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Invalid or expired refresh token",
      "code": "INVALID_REFRESH_TOKEN"
    }
    ```
  - `HTTP 429 Too Many Requests`: 速率超限 - Rate limit exceeded (20 次/用户/小时).
- **速率限制 (Rate Limit)**: 20 次/用户/小时 - 20 requests per user per hour.
- **调用示例 (cURL Example)**:
  ```bash
  curl -X POST [https://api.example.com/api/v1/auth/token/refresh](https://api.example.com/api/v1/auth/token/refresh) \
    -H "Content-Type: application/json" \
    -d '{"refresh_token": "abc"}'
  ```

---

### 6. 登出 - Logout
- **端点 (Endpoint)**: `POST /api/v1/auth/logout`
- **描述 (Description)**: 失效当前的访问令牌和刷新令牌 - Invalidates the current access token and refresh token.
- **请求方法 (Method)**: `POST`
- **请求路径 (Path)**: `/api/v1/auth/logout`
- **请求头 (Request Headers)**:
  - `Authorization: Bearer <token>`: **必填**。  访问令牌，通过 Bearer 认证方式传递。 - **Required**. Access token, transmitted via Bearer authentication.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": null,
    "message": "Logged out successfully",
    "code": "SUCCESS_LOGOUT" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 401 Unauthorized`: 令牌无效或已加入黑名单 - Invalid token or already logged out (token is blacklisted).
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Invalid or already logged out",
      "code": "INVALID_TOKEN"
    }
    ```
- **令牌黑名单 (Token Blacklisting)**:  成功登出后，访问令牌和刷新令牌将被加入黑名单 - Upon successful logout, the access token and refresh token are added to the blacklist.
- **调用示例 (cURL Example)**:
  ```bash
  curl -X POST [https://api.example.com/api/v1/auth/logout](https://api.example.com/api/v1/auth/logout) \
    -H "Authorization: Bearer xyz"
  ```

---

## 用户资源端点（需要认证） - User Resource Endpoints (Requires Authentication)

### 7. 获取当前用户信息 - Get Current User Info
- **端点 (Endpoint)**: `GET /api/v1/users/me`
- **描述 (Description)**: 获取已认证用户的信息 - Retrieves information of the currently authenticated user.
- **请求方法 (Method)**: `GET`
- **请求路径 (Path)**: `/api/v1/users/me`
- **请求头 (Request Headers)**:
  - `Authorization: Bearer <token>`: **必填**。  访问令牌，通过 Bearer 认证方式传递。 - **Required**. Access token, transmitted via Bearer authentication.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "username": "johndoe",
      "email": "john@example.com",
      "roles": ["user"], // 示例角色 - Example roles
      "is_email_verified": false,
      "two_factor_enabled": false
    },
    "message": "User info retrieved successfully",
    "code": "SUCCESS_GET_USER_INFO" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 401 Unauthorized`:  未授权 - Unauthorized (invalid token or token is blacklisted).
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Unauthorized",
      "code": "UNAUTHORIZED"
    }
    ```
- **调用示例 (cURL Example)**:
  ```bash
  curl -X GET [https://api.example.com/api/v1/users/me](https://api.example.com/api/v1/users/me) \
    -H "Authorization: Bearer xyz"
  ```

---

### 8. 修改密码 - Change Password
- **端点 (Endpoint)**: `PATCH /api/v1/users/me/password`
- **描述 (Description)**: 更新当前用户的密码 - Updates the password of the currently authenticated user.
- **请求方法 (Method)**: `PATCH`
- **请求路径 (Path)**: `/api/v1/users/me/password`
- **请求头 (Request Headers)**:
  - `Authorization: Bearer <token>`: **必填**。  访问令牌，通过 Bearer 认证方式传递。 - **Required**. Access token, transmitted via Bearer authentication.
- **请求体 (Request Body)**: `application/json`
- **请求参数 (Request Parameters)**:
  - `old_password` (字符串): **必填**。  当前密码。 - **Required**. Current password.
  - `new_password` (字符串, 最小 8 字符, **必须**包含 1 个大写字母、1 个小写字母、1 个数字): **必填**。 新密码， 必须符合密码强度要求。 - **Required**. New password, must meet password complexity requirements: minimum 8 characters, and include at least one uppercase letter, one lowercase letter, and one digit.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": null,
    "message": "Password updated successfully",
    "code": "SUCCESS_UPDATE_PASSWORD" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 400 Bad Request`: 新密码格式错误 - Invalid new password format.
    ```json
    {
      "status": "error",
      "data": {"field": "new_password", "reason": "Password must include uppercase, lowercase, and digit"},
      "message": "Invalid password",
      "code": "INVALID_PASSWORD"
    }
    ```
  - `HTTP 401 Unauthorized`:  旧密码错误或令牌无效 - Incorrect old password or invalid token.
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Incorrect old password",
      "code": "INCORRECT_PASSWORD"
    }
    ```
  - `HTTP 429 Too Many Requests`: 速率超限 - Rate limit exceeded (5 次/用户/小时).
- **速率限制 (Rate Limit)**: 5 次/用户/小时 - 5 requests per user per hour.
- **调用示例 (cURL Example)**:
  ```bash
  curl -X PATCH [https://api.example.com/api/v1/users/me/password](https://api.example.com/api/v1/users/me/password) \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer xyz" \
    -d '{"old_password": "Password123", "new_password": "NewPass123"}'
  ```

---

### 9. 发送邮箱验证邮件 - Send Email Verification Email
- **端点 (Endpoint)**: `POST /api/v1/users/me/verify-email/send`
- **描述 (Description)**: 发送邮箱验证代码到用户邮箱 - Sends an email verification code to the user's registered email address.
- **请求方法 (Method)**: `POST`
- **请求路径 (Path)**: `/api/v1/users/me/verify-email/send`
- **请求头 (Request Headers)**:
  - `Authorization: Bearer <token>`: **必填**。  访问令牌，通过 Bearer 认证方式传递。 - **Required**. Access token, transmitted via Bearer authentication.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": null,
    "message": "Verification email sent",
    "code": "SUCCESS_SEND_VERIFY_EMAIL" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 400 Bad Request`: 邮箱已验证 - Email already verified.
    ```json
    {
      "status": "error",
      "data": null,
      "message": "Email already verified",
      "code": "EMAIL_ALREADY_VERIFIED"
    }
    ```
  - `HTTP 401 Unauthorized`:  令牌无效 - Invalid token.
  - `HTTP 429 Too Many Requests`: 速率超限 - Rate limit exceeded (3 次/用户/天).
- **速率限制 (Rate Limit)**: 3 次/用户/天 - 3 requests per user per day.
- **调用示例 (cURL Example)**:
  ```bash
  curl -X POST [https://api.example.com/api/v1/users/me/verify-email/send](https://api.example.com/api/v1/users/me/verify-email/send) \
    -H "Authorization: Bearer xyz"
  ```

---

### 10. 验证邮箱 - Verify Email
- **端点 (Endpoint)**: `PATCH /api/v1/users/me/verify-email`
- **描述 (Description)**: 使用邮箱验证码验证用户邮箱 - Verifies user email address using a verification code.
- **请求方法 (Method)**: `PATCH`
- **请求路径 (Path)**: `/api/v1/users/me/verify-email`
- **请求头 (Request Headers)**:
  - `Authorization: Bearer <token>`: **必填**。  访问令牌，通过 Bearer 认证方式传递。 - **Required**. Access token, transmitted via Bearer authentication.
- **请求体 (Request Body)**: `application/json`
- **请求参数 (Request Parameters)**:
  - `code` (字符串, 6 字符, 字母数字): **必填**。  邮箱验证码，通常通过邮件发送给用户。 - **Required**. Email verification code, usually sent to the user's email address, 6 alphanumeric characters.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "is_email_verified": true
    },
    "message": "Email verified successfully",
    "code": "SUCCESS_VERIFY_EMAIL" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 400 Bad Request`: 验证码无效或邮箱已验证 - Invalid or expired verification code, or email already verified.
    ```json
    {
      "status": "error",
      "data": {"field": "code", "reason": "Invalid or expired code"},
      "message": "Verification failed",
      "code": "INVALID_CODE"
    }
    ```
  - `HTTP 401 Unauthorized`:  令牌无效 - Invalid token.
  - `HTTP 429 Too Many Requests`: 速率超限 - Rate limit exceeded (10 次/用户/小时).
- **速率限制 (Rate Limit)**: 10 次/用户/小时 - 10 requests per user per hour.
- **调用示例 (cURL Example)**:
  ```bash
  curl -X PATCH [https://api.example.com/api/v1/users/me/verify-email](https://api.example.com/api/v1/users/me/verify-email) \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer xyz" \
    -d '{"code": "ABC123"}'
  ```

---

## 两步验证（2FA）端点（需要认证） - Two-Factor Authentication (2FA) Endpoints (Requires Authentication)

### 11. 启用 2FA - Enable 2FA
- **端点 (Endpoint)**: `POST /api/v1/2fa/enable`
- **描述 (Description)**: 发起 2FA 设置，返回密钥、二维码和备用码 - Initiates 2FA setup, returns secret key, QR code URL, and backup codes.
- **请求方法 (Method)**: `POST`
- **请求路径 (Path)**: `/api/v1/2fa/enable`
- **请求头 (Request Headers)**:
  - `Authorization: Bearer <token>`: **必填**。  访问令牌，通过 Bearer 认证方式传递。 - **Required**. Access token, transmitted via Bearer authentication.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "secret": "JBSWY3DPEHPK3PXP", // TOTP 密钥 - TOTP secret key
      "qr_code_url": "[https://example.com/qr/123](https://example.com/qr/123)", // 二维码 URL - QR code URL for scanning
      "backup_codes": ["12345678", "87654321"] // 备用码列表 - List of backup codes (建议用户妥善保存) -  (recommend user to securely store backup codes)
    },
    "message": "2FA setup initiated, verify to activate",
    "code": "SUCCESS_INIT_2FA" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 400 Bad Request`: 2FA 已启用 - 2FA already enabled.
    ```json
    {
      "status": "error",
      "data": null,
      "message": "2FA already enabled",
      "code": "2FA_ALREADY_ENABLED"
    }
    ```
  - `HTTP 401 Unauthorized`:  令牌无效 - Invalid token.
  - `HTTP 429 Too Many Requests`: 速率超限 - Rate limit exceeded (3 次/用户/天).
- **速率限制 (Rate Limit)**: 3 次/用户/天 - 3 requests per user per day.
- **调用示例 (cURL Example)**:
  ```bash
  curl -X POST [https://api.example.com/api/v1/2fa/enable](https://api.example.com/api/v1/2fa/enable) \
    -H "Authorization: Bearer xyz"
  ```

---

### 12. 验证 2FA 设置 - Verify 2FA Setup
- **端点 (Endpoint)**: `POST /api/v1/2fa/verify`
- **描述 (Description)**: 激活 2FA - Activates Two-Factor Authentication (2FA).
- **请求方法 (Method)**: `POST`
- **请求路径 (Path)**: `/api/v1/2fa/verify`
- **请求头 (Request Headers)**:
  - `Authorization: Bearer <token>`: **必填**。  访问令牌，通过 Bearer 认证方式传递。 - **Required**. Access token, transmitted via Bearer authentication.
- **请求体 (Request Body)**: `application/json`
- **请求参数 (Request Parameters)**:
  - `code` (字符串, 6 位数字): **必填**。  认证 App 生成的 6 位数字验证码。 - **Required**. Verification code generated by the authenticator app, 6 digits.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "two_factor_enabled": true
    },
    "message": "2FA activated successfully",
    "code": "SUCCESS_VERIFY_2FA" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 400 Bad Request`: 验证码无效 - Invalid 2FA code.
    ```json
    {
      "status": "error",
      "data": {"field": "code", "reason": "Invalid 2FA code"},
      "message": "Verification failed",
      "code": "INVALID_2FA_CODE"
    }
    ```
  - `HTTP 401 Unauthorized`:  令牌无效 - Invalid token.
  - `HTTP 429 Too Many Requests`: 速率超限 - Rate limit exceeded (10 次/用户/小时).
- **速率限制 (Rate Limit)**: 10 次/用户/小时 - 10 requests per user per hour.
- **调用示例 (cURL Example)**:
  ```bash
  curl -X POST [https://api.example.com/api/v1/2fa/verify](https://api.example.com/api/v1/2fa/verify) \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer xyz" \
    -d '{"code": "654321"}'
  ```

---

## 单点登录（SSO）端点（混合访问） - Single Sign-On (SSO) Endpoints (Mixed Access)

### 13. SSO 登录发起 - Initiate SSO Login
- **端点 (Endpoint)**: `GET /api/v1/sso/{provider}`
- **描述 (Description)**: 发起 SSO 登录流程，重定向至 SSO 提供商的授权页面 - Initiates the SSO login flow, redirects to the authorization page of the SSO provider.
- **请求方法 (Method)**: `GET`
- **请求路径 (Path)**: `/api/v1/sso/{provider}`
- **路径参数 (Path Parameters)**:
  - `provider` (字符串, 枚举: "google", "github", 等, **仅支持已集成的 SSO 提供商**): **必填**。 SSO 提供商的名称。  目前支持的提供商请参考具体实现文档。 - **Required**. SSO provider name.  Enum: "google", "github", etc. **Only supports integrated SSO providers**. Please refer to implementation documentation for currently supported providers.
- **成功返回 (Success Response)** - `HTTP 302 Found`:  **重定向 (Redirect)** - **服务器将返回 HTTP 302 状态码，并设置 `Location` Header 指向 SSO 提供商的授权 URL， 客户端 (通常是浏览器)  需要自动重定向到该 URL。** - **Redirect**. Server will return HTTP 302 status code and set the `Location` header to the authorization URL of the SSO provider. The client (usually a browser) should automatically redirect to this URL.
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 400 Bad Request`: 不支持的 SSO 提供商 - Unsupported SSO provider.
    ```json
    {
      "status": "error",
      "data": {"field": "provider", "reason": "Unsupported provider"},
      "message": "Invalid provider",
      "code": "INVALID_PROVIDER"
    }
    ```
  - `HTTP 429 Too Many Requests`: 速率超限 - Rate limit exceeded (10 次/IP/分钟).
- **速率限制 (Rate Limit)**: 10 次/IP/分钟 - 10 requests per IP address per minute.
- **调用示例 (cURL Example)**:
  ```bash
  # 浏览器访问示例 - Browser access example:
  #  在浏览器中直接访问以下 URL，将会被重定向到 Google 的授权页面 - Access the following URL directly in the browser, you will be redirected to Google's authorization page.
  #  请注意， cURL 默认不会自动处理 302 重定向， 您需要使用浏览器或配置 cURL 追踪重定向 - Please note that cURL does not automatically handle 302 redirects by default. You need to use a browser or configure cURL to follow redirects.
  [https://api.example.com/api/v1/sso/google](https://api.example.com/api/v1/sso/google)
  ```

---

### 14. SSO 回调 - SSO Callback
- **端点 (Endpoint)**: `GET /api/v1/sso/{provider}/callback`
- **描述 (Description)**:  处理 SSO 提供商的回调，验证授权码，颁发令牌和用户信息 - Handles the callback from the SSO provider, verifies the authorization code, and issues tokens and user information.
- **请求方法 (Method)**: `GET`
- **请求路径 (Path)**: `/api/v1/sso/{provider}/callback`
- **路径参数 (Path Parameters)**:
  - `provider` (字符串, 枚举: "google", "github", 等, **必须与登录发起时使用的提供商一致**): **必填**。 SSO 提供商的名称，必须与 SSO 登录发起端点 (`/api/v1/sso/{provider}`)  中使用的 `provider` 参数值保持一致。 - **Required**. SSO provider name. Enum: "google", "github", etc. **Must be consistent with the provider used in the login initiation**.
- **查询参数 (Query Parameters)**:
  - `code` (字符串): **必填**。  SSO 提供商回调时提供的授权码。 - **Required**. Authorization code provided by the SSO provider during callback.
  - `state` (字符串,  **强烈建议携带，用于 CSRF 防护**): **可选， 但强烈建议携带**。  CSRF 状态参数，用于防止跨站请求伪造攻击。  建议在 SSO 登录发起时生成并存储 `state` 参数，并在回调时验证 `state` 参数的一致性。 - **Optional, but strongly recommended**. CSRF state parameter, used to prevent Cross-Site Request Forgery attacks. It is recommended to generate and store the `state` parameter during SSO login initiation and verify the consistency of the `state` parameter during callback.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "access_token": "xyz",
      "token_type": "bearer",
      "refresh_token": "abc",
      "expires_in": 3600, // 单位：秒 - in seconds
      "user": { // SSO 登录后的用户信息 - User information after successful SSO login
        "username": "johndoe",
        "email": "john@example.com"
      }
    },
    "message": "SSO login successful",
    "code": "SUCCESS_SSO_LOGIN" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)**:
  - `HTTP 400 Bad Request`: 授权码或 state 无效 - Invalid authorization code or state parameter.
    ```json
    {
      "status": "error",
      "data": {"field": "code", "reason": "Invalid authorization code"},
      "message": "SSO login failed",
      "code": "INVALID_SSO_CODE"
    }
    ```
  - `HTTP 429 Too Many Requests`: 速率超限 - Rate limit exceeded (10 次/IP/分钟).
- **速率限制 (Rate Limit)**: 10 次/IP/分钟 - 10 requests per IP address per minute.
- **调用示例 (cURL Example)**:
  ```bash
  curl -X GET "[https://api.example.com/api/v1/sso/google/callback?code=authCode&state=csrfState](https://api.example.com/api/v1/sso/google/callback?code=authCode&state=csrfState)"
  ```

---

## 健康检查端点 - Health Check Endpoint

### 15. 健康检查 - Health Check
- **端点 (Endpoint)**: `GET /api/v1/health`
- **描述 (Description)**: 检查服务及其依赖的健康状况 - Checks the health status of the service and its dependencies.
- **请求方法 (Method)**: `GET`
- **请求路径 (Path)**: `/api/v1/health`
- **请求参数 (Request Parameters)**: 无 - None.
- **成功返回示例 (Success Response Example)** - `HTTP 200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "overall": "healthy", // 整体服务健康状态 - Overall service health status
      "database": "ok",     // 数据库连接状态 - Database connection status
      "cache": "ok"        // 缓存系统连接状态 - Cache system connection status
    },
    "message": "Service is operational",
    "timestamp": "2025-02-25T10:00:00Z", // 响应时间戳 - Response timestamp (ISO 8601 format)
    "code": "SUCCESS_HEALTH_CHECK" // 补充了成功代码
  }
  ```
- **错误响应示例 (Error Response Examples)** - `HTTP 503 Service Unavailable`: 服务不可用。
    ```json
    {
      "status": "error",
      "data": {"component": "database", "reason": "Connection failed"}, // 故障组件及原因 - Component experiencing issues and the reason
      "message": "Service unavailable",
      "code": "SERVICE_UNAVAILABLE"
    }
    ```
- **调用示例 (cURL Example)**:
  ```bash
  curl -X GET [https://api.example.com/api/v1/health](https://api.example.com/api/v1/health)
  ```

---

1. **一致性**: 所有端点的响应结构都严格遵循 `{status, data, message, code}` 格式，包括健康检查端点，并补充了 `code` 字段。
2. **清晰性**: 为每个参数添加了更具体的约束说明，例如数据类型、格式、长度限制和规则，提升文档精度。
3. **安全性**: 在文档开头和重要部分更突出地强调了 HTTPS、CORS 和 API 密钥等安全建议，强化安全上下文。
4. **调用示例**:  再次审核并完善了每个端点的 cURL 示例，确保示例的正确性和完整性，方便开发者测试。
5. **状态码**:  细化了 `201 Created` 和 `302 Found` 的适用场景描述。
