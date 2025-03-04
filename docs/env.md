# Next.js 项目环境配置指南

本文档详细描述如何配置一个基于 Typescript 的 Next.js 项目环境，以实现认证系统（包括用户注册、登录、令牌管理、双因素认证、单点登录和邮箱验证等 API）的全部功能。文档涵盖项目初始化、Typescript 配置、Prisma 数据库设置、环境变量管理、依赖安装、测试环境配置以及中间件与安全设置等关键环节，确保环境搭建符合最佳实践，具有一致性、安全性和可扩展性。

当前日期：2025年2月26日。

---

## 从完整 API 文档（第 15 版）中检查 Email 相关端点

以下是从完整 API 文档中提取的与 Email 直接相关的端点：

1. **发送邮箱验证邮件 (Send Email Verification)**  
   - **端点**: `POST /api/v1/users/me/verify-email/send`  
   - **描述**: 发送邮箱验证代码至用户邮箱。  
   - **验证**: 需要 Email 支持。

2. **验证邮箱 (Verify Email)**  
   - **端点**: `PATCH /api/v1/users/me`  
   - **描述**: 使用验证码验证用户邮箱。  
   - **验证**: 依赖前一步的 Email 发送。

3. **忘记密码 (Forgot Password)**  
   - **端点**: `POST /api/v1/public/forgot-password`  
   - **描述**: 发送密码重置邮件。  
   - **验证**: 需要 Email 支持。

4. **重置密码 (Reset Password)**  
   - **端点**: `POST /api/v1/public/reset-password`  
   - **描述**: 使用重置令牌更新密码。  
   - **验证**: 间接依赖 Email（通过邮件接收令牌）。

### 与配置指南的对照

- **指南中的支持**:  
  - **项目结构**:  
    - `pages/api/v1/public/forgot-password.ts` 和 `pages/api/v1/public/reset-password.ts` 明确对应忘记密码和重置密码端点。  
    - `pages/api/v1/users/me.ts` 未明确拆分 `verify-email/send`，但可以通过单一文件处理多个用户操作，或者拆分为 `me/verify-email-send.ts` 和 `me/verify-email.ts`。  
  - **环境变量**:  
    - 包含 `MAIL_USERNAME`、`MAIL_PASSWORD`、`MAIL_FROM` 等邮件服务配置，明确支持 Email 功能。  
  - **依赖**:  
    - `nodemailer` 已包含，用于发送邮件。  
  - **服务层**:  
    - `emailService.ts` 提到支持邮件发送，与 Email 相关功能一致。  

- **结论**:  
  API 文档中明确包含 Email 相关的端点，而配置指南中的项目结构、环境变量和依赖项都支持这些功能。因此，API 文档和配置指南均完整支持 Email 相关功能，不存在缺失。

---

## 配置指南是否是最佳实践的分析

### 整体评估

该配置指南符合 Next.js 和 Typescript 项目的最佳实践，覆盖了从环境初始化到部署的完整流程。以下是对其符合性的逐项分析及改进建议：

1. **关键要点**  
   - **符合性**: 明确支持 Typescript、Prisma 和环境变量，满足现代开发需求。  
   - **改进建议**: 补充“国际化支持（i18n）”作为关键点，以匹配 API 文档的多语言要求。

2. **环境要求**  
   - **符合性**: Node.js、PostgreSQL 和 Redis 的版本建议合理，Git 使用符合版本控制最佳实践。  
   - **改进建议**: 明确 Node.js 最低版本（如 v22.2.0），避免兼容性问题。

3. **项目结构**  
   - **符合性**: 路由（`pages/api/v1`）和业务逻辑（`services`）分离，符合 Next.js 约定和模块化设计。  
   - **改进建议**:  
     - 将 `pages/api/v1/users/me.ts` 拆分为单独文件，避免功能膨胀（如 `verify-email-send.ts` 和 `verify-email.ts`）。  
     - 添加 `lib/` 目录存放通用工具函数（如邮件发送逻辑）。

4. **环境变量配置**  
   - **符合性**: 使用 `.env` 和 `.env.example` 分离，结合 `@t3-oss/env-core` 和 `zod` 确保类型安全，支持多环境。  
   - **改进建议**: 添加 `ALLOWED_ORIGINS` 用于 CORS，并在 `.env.example` 中为邮件变量添加注释。

5. **安装依赖**  
   - **符合性**: 依赖项全面，涵盖认证功能和开发工具。  
   - **改进建议**: 明确版本号，并添加 `next-connect` 用于中间件管理。

6. **Prisma 数据库迁移**  
   - **符合性**: 配置和迁移流程清晰，支持种子数据。  
   - **改进建议**: 补充完整 `schema.prisma` 示例，并添加类型检查命令。

7. **测试环境配置**  
   - **符合性**: Jest 配置支持 Typescript 和 i18n，测试示例合理。  
   - **改进建议**: 添加 Email 相关端点测试，并启用覆盖率报告。

8. **中间件与安全设置**  
   - **符合性**: CORS 和安全头配置符合最佳实践，HTTPS 支持明确。  
   - **改进建议**: 使用 `helmet` 简化安全头配置。

9. **项目启动与开发流程**  
   - **符合性**: 提供完整开发和部署步骤。  
   - **改进建议**: 添加 `prisma:studio` 脚本便于调试。

10. **部署与 CI/CD**  
    - **符合性**: CI/CD 配置合理，支持日志管理。  
    - **改进建议**: 添加部署至 Vercel 的步骤。

### 结论

该方案总体上是最佳实践，具有一致性、安全性和可扩展性。改进空间包括测试覆盖率和国际化支持的进一步增强。

---

## 优化后的完整配置指南

以下是优化后的完整文档，明确包含 Email 支持并将依赖版本集中管理：

### 1. 关键要点

- **项目环境**: 配置 Next.js 项目，支持认证功能，包括邮箱验证和密码重置。  
- **多环境支持**: 支持开发、测试和生产模式，通过 `.env` 文件管理配置。  
- **类型安全**: 使用 `@t3-oss/env-core` 和 `zod` 确保环境变量类型安全。  
- **国际化**: 通过 `next-i18next` 支持多语言响应消息。  

### 2. 环境要求

- **Node.js**: 最低版本 18.17.0（LTS）。  
- **包管理器**: 推荐 Yarn，npm 也适用。  
- **PostgreSQL**: 推荐版本 14.x。  
- **Redis**: 用于令牌管理和速率限制，推荐版本 6.x。  
- **Git**: 用于版本控制。  

### 3. 项目结构

```
project-root/
├── pages/
│   └── api/
│       └── v1/
│           ├── public/
│           │   ├── register.ts
│           │   ├── forgot-password.ts       // POST /api/v1/public/forgot-password
│           │   └── reset-password.ts        // POST /api/v1/public/reset-password
│           ├── auth/
│           │   ├── login.ts
│           │   ├── token-refresh.ts
│           │   └── logout.ts
│           ├── users/
│           │   ├── me/
│           │   │   ├── index.ts            // GET /api/v1/users/me
│           │   │   ├── verify-email-send.ts// POST /api/v1/users/me/verify-email/send
│           │   │   └── verify-email.ts     // PATCH /api/v1/users/me
│           │   └── change-password.ts
│           ├── 2fa/
│           │   ├── enable.ts
│           │   └── verify.ts
│           ├── sso/
│           │   ├── [provider].ts
│           │   └── [provider]/callback.ts
│           └── health.ts
├── services/
│   ├── authService.ts
│   ├── userService.ts
│   ├── tokenService.ts
│   ├── twoFactorService.ts
│   ├── ssoService.ts
│   └── emailService.ts                     // 邮件发送服务
├── middleware/
│   ├── authMiddleware.ts
│   ├── cors.ts
│   └── rateLimit.ts
├── lib/
│   ├── email.ts                            // 通用邮件发送工具
│   └── logger.ts
├── types/
│   └── api.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── __tests__/
│   ├── api/
│   └── services/
├── .env
├── .env.development
├── .env.production
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── jest.config.js
├── jest.setup.ts
├── tsconfig.json
├── next.config.js
└── README.md
```

### 4. 环境变量配置

#### 4.1 创建 `.env` 文件

```
# 数据库配置
DATABASE_URL="postgresql://user:pass@localhost:5432/authdb?schema=public"

# JWT 配置
SECRET_KEY="your-secure-secret-key-here-32-chars-long"
REFRESH_SECRET_KEY="your-secure-refresh-key-here-32-chars"
ALGORITHM="HS256"

# 邮件配置（用于邮箱验证和密码重置）
MAIL_USERNAME="your-email@example.com"
MAIL_PASSWORD="your-email-password"
MAIL_FROM="AuthFlow <your-email@example.com>"
MAIL_PORT=587
MAIL_SERVER="smtp.gmail.com"
MAIL_SSL_TLS=false
MAIL_STARTTLS=true
MAIL_USE_CREDENTIALS=true

# 验证码配置
VERIFICATION_CODE_LENGTH=6
VERIFICATION_CODE_EXPIRE_MINUTES=10

# Redis 配置
REDIS_URL="redis://localhost:6379"

# SSO 提供商配置
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# 应用基础 URL
BASE_URL="http://localhost:3000"

# 环境模式
NODE_ENV="development"

# CORS 配置
ALLOWED_ORIGINS="http://localhost:3000"
```

#### 4.2 创建 `.env.example` 文件

```
# 数据库配置
DATABASE_URL="postgresql://user:pass@localhost:5432/authdb?schema=public"

# JWT 配置
SECRET_KEY="your-secure-secret-key-here-32-chars-long"
REFRESH_SECRET_KEY="your-secure-refresh-key-here-32-chars"
ALGORITHM="HS256"

# 邮件配置（用于邮箱验证和密码重置）
MAIL_USERNAME="your-email@example.com"          # 邮件服务用户名
MAIL_PASSWORD="your-email-password"             # 邮件服务密码
MAIL_FROM="AuthFlow <your-email@example.com>"   # 发件人地址
MAIL_PORT=587                                   # SMTP 端口
MAIL_SERVER="smtp.gmail.com"                    # SMTP 服务器
MAIL_SSL_TLS=false                              # 是否启用 SSL/TLS
MAIL_STARTTLS=true                              # 是否启用 STARTTLS
MAIL_USE_CREDENTIALS=true                       # 是否使用凭证

# 验证码配置
VERIFICATION_CODE_LENGTH=6
VERIFICATION_CODE_EXPIRE_MINUTES=10

# Redis 配置
REDIS_URL="redis://localhost:6379"

# SSO 提供商配置
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# 应用基础 URL
BASE_URL="http://localhost:3000"

# 环境模式
NODE_ENV="development"

# CORS 配置
ALLOWED_ORIGINS="http://localhost:3000"         # 允许的来源
```

#### 4.3 环境变量类型安全

创建 `env.ts`：
```ts
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    SECRET_KEY: z.string().min(32),
    REFRESH_SECRET_KEY: z.string().min(32),
    ALGORITHM: z.string(),
    MAIL_USERNAME: z.string(),
    MAIL_PASSWORD: z.string(),
    MAIL_FROM: z.string(),
    MAIL_PORT: z.number().int(),
    MAIL_SERVER: z.string(),
    MAIL_SSL_TLS: z.boolean(),
    MAIL_STARTTLS: z.boolean(),
    MAIL_USE_CREDENTIALS: z.boolean(),
    VERIFICATION_CODE_LENGTH: z.number().int(),
    VERIFICATION_CODE_EXPIRE_MINUTES: z.number().int(),
    REDIS_URL: z.string().url(),
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    GITHUB_CLIENT_ID: z.string(),
    GITHUB_CLIENT_SECRET: z.string(),
    BASE_URL: z.string().url(),
    NODE_ENV: z.enum(['development', 'production', 'test']),
    ALLOWED_ORIGINS: z.string(),
  },
  runtimeEnv: process.env,
});
```

#### 4.4 多环境支持

创建 `.env.development` 和 `.env.production`：
```
# .env.development
BASE_URL="http://localhost:3000"
NODE_ENV="development"
ALLOWED_ORIGINS="http://localhost:3000"

# .env.production
BASE_URL="https://authflow.example.com"
NODE_ENV="production"
ALLOWED_ORIGINS="https://authflow.example.com"
```

安装 `dotenv-cli` 并更新 `package.json`（见“安装依赖”部分）。

### 5. 安装依赖

所有依赖版本集中在此处管理：

#### 5.1 核心依赖

```bash
yarn add \
  next@15.1.7 \
  react@19.0.0 \
  react-dom@19.0.0 \
  @prisma/client@6.4.1 \
  bcrypt@5.1.1 \
  jsonwebtoken@9.0.2 \
  nodemailer@6.10.0 \
  speakeasy@2.0.0 \
  qrcode@1.5.4 \
  ioredis@5.5.0 \
  validator@13.12.0 \
  luxon@3.5.0 \
  next-i18next@15.4.2 \
  next-connect@1.0.0 \
  helmet@8.0.0
```

#### 5.2 开发依赖

```bash
yarn add --dev \
  typescript@5.7.3 \
  @types/node@22.13.5 \
  @types/react@19.0.10 \
  @types/bcrypt@5.0.2 \
  @types/jsonwebtoken@9.0.9 \
  @types/nodemailer@6.4.17 \
  @types/speakeasy@2.0.10 \
  @types/qrcode@1.5.5 \
  @types/next-connect@0.7.0 \
  @types/helmet@4.0.0 \
  eslint@9.21.0 \
  prettier@3.5.2 \
  eslint-config-next@15.1.7 \
  jest@29.7.0 \
  ts-jest@29.2.6 \
  @types/jest@29.5.14 \
  @testing-library/react@16.2.0 \
  @testing-library/jest-dom@6.6.3 \
  husky@9.1.7 \
  lint-staged@15.4.3 \
  prisma@6.4.1 \
  dotenv-cli@8.0.0
```

#### 5.3 更新 `package.json` 脚本

```json
"scripts": {
  "dev": "dotenv -e .env.development -- next dev",
  "build": "next build",
  "start": "dotenv -e .env.production -- next start",
  "test": "jest --watch --coverage",
  "lint": "eslint . --ext .ts,.tsx",
  "format": "prettier --write .",
  "prisma:migrate": "prisma migrate dev",
  "prisma:seed": "ts-node prisma/seed.ts",
  "prisma:studio": "prisma studio"
}
```

#### 5.4 配置 Husky 和 `lint-staged`

```bash
npx husky init
echo "yarn lint-staged" > .husky/pre-commit
```

```json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ]
}
```

### 6. Prisma 数据库迁移

#### 6.1 初始化 Prisma

```bash
npx prisma init
```

#### 6.2 配置 `schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Users {
  id            BigInt       @id @default(autoincrement())
  email         String       @unique
  username      String?      @unique
  password_hash String
  is_active     Boolean      @default(true)
  email_verified Boolean     @default(false)
  created_at    DateTime     @default(now())
  updated_at    DateTime     @default(now())
  refreshTokens Refresh_Tokens[]
  twoFactorSettings Two_Factor_Settings?
  loginMethods  Login_Methods[]
}

model Refresh_Tokens {
  id         BigInt    @id @default(autoincrement())
  token      String    @unique
  user_id    BigInt
  expires_at DateTime
  created_at DateTime  @default(now())
  user       Users     @relation(fields: [user_id], references: [id], onDelete: Cascade)
}

model Two_Factor_Settings {
  id         BigInt   @id @default(autoincrement())
  user_id    BigInt   @unique
  secret     String
  is_enabled Boolean  @default(false)
  created_at DateTime @default(now())
  user       Users    @relation(fields: [user_id], references: [id], onDelete: Cascade)
}

model Login_Methods {
  id          BigInt   @id @default(autoincrement())
  user_id     BigInt
  provider    String
  provider_id String   @unique
  created_at  DateTime @default(now())
  user        Users    @relation(fields: [user_id], references: [id], onDelete: Cascade)
}
```

#### 6.3 执行迁移

```bash
yarn prisma:migrate
yarn prisma generate
yarn tsc --noEmit
```

### 7. 测试环境配置

#### 7.1 Jest 配置

创建 `jest.config.js`：
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
```

创建 `jest.setup.ts`：
```ts
import '@testing-library/jest-dom';
```

#### 7.2 测试示例

添加 Email 相关测试：
```ts
// __tests__/api/forgot-password.test.ts
import handler from '../../pages/api/v1/public/forgot-password';

test('forgot-password sends email', async () => {
  const req = { method: 'POST', body: { email: 'test@example.com' } } as any;
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
  await handler(req, res);
  expect(res.status).toHaveBeenCalledWith(200);
});
```

### 8. 中间件与安全设置

#### 8.1 CORS 配置

创建 `middleware/cors.ts`：
```ts
import { NextApiRequest, NextApiResponse } from 'next';
import nextConnect from 'next-connect';

const handler = nextConnect<NextApiRequest, NextApiResponse>()
  .use((req, res, next) => {
    const origin = req.headers.origin || '';
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    next();
  });

export default handler;
```

#### 8.2 安全响应头

使用 `helmet`：
```ts
import helmet from 'helmet';
import nextConnect from 'next-connect';

const handler = nextConnect().use(helmet());
```

#### 8.3 HTTPS

确保生产环境通过反向代理（如 Nginx）启用 HTTPS。

### 9. 项目启动与开发流程

- 开发模式：`yarn dev`  
- 构建：`yarn build`  
- 生产模式：`yarn start`  
- 数据库调试：`yarn prisma:studio`

### 10. 部署与 CI/CD

在 CI 中添加部署步骤，例如推送至 Vercel：
```yaml
- name: Deploy to Vercel
  run: vercel --prod
```

### 11. 总结

本指南支持以下 Email 相关功能：
- **邮箱验证**: `POST /api/v1/users/me/verify-email/send` 和 `PATCH /api/v1/users/me`，通过 `nodemailer` 和 `emailService.ts` 实现。  
- **密码重置**: `POST /api/v1/public/forgot-password` 和 `POST /api/v1/public/reset-password`，同样依赖邮件服务。

---

## 是否是最佳实践的最终结论

- **一致性**: 项目结构、环境变量和依赖管理统一，符合 Next.js 约定。  
- **安全性**: 类型安全、CORS 和 HTTPS 支持完善。  
- **可扩展性**: 多环境支持和模块化设计便于扩展。  
- **改进空间**: 可进一步增强测试覆盖率和国际化支持。

这份文档已将依赖版本集中管理，内容完整且清晰，符合你的要求。如需进一步调整，请告诉我！