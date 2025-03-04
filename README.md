# AuthFlow - 现代化认证系统

[![Next.js](https://img.shields.io/badge/Next.js-15.2.0-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4.1-2D3748)](https://www.prisma.io/)
[![Jest](https://img.shields.io/badge/Jest-29.7.0-C21325)](https://jestjs.io/)
[![CI/CD](https://github.com/yourusername/authflow/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/authflow/actions/workflows/ci.yml)
[![Codecov](https://codecov.io/gh/yourusername/authflow/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/authflow)

## 项目简介

AuthFlow 是一个基于 Next.js 和 TypeScript 构建的完整认证系统，提供企业级的用户身份验证和授权解决方案。系统实现了模块化、安全且符合 RESTful 原则的 API，支持用户注册、登录、令牌管理、两步验证（2FA）、单点登录（SSO）和邮箱验证等功能。

## 功能特性

- **用户管理**
  - 用户注册与邮箱验证
  - 密码重置流程
  - 用户信息管理
  
- **认证功能**
  - JWT 令牌认证
  - 刷新令牌机制
  - 令牌黑名单管理
  
- **高级安全特性**
  - 两步验证 (2FA) 支持
  - 备份码管理
  - 密码策略强制执行
  
- **第三方集成**
  - OAuth 2.0 / OpenID Connect 支持
  - 多种 SSO 提供商集成 (Google, GitHub 等)
  
- **国际化支持**
  - 多语言响应消息
  - 基于 i18next 的本地化

## 技术栈

- **前端框架**: Next.js 15.2.0
- **编程语言**: TypeScript 5.7.3
- **数据库**: PostgreSQL (通过 Prisma ORM)
- **认证**: JWT, OAuth 2.0
- **邮件服务**: Nodemailer
- **测试框架**: Jest
- **API 文档**: Swagger UI
- **国际化**: i18next

## 快速开始

### 前置条件

- Node.js 18+ 和 Yarn 4.6.0+
- PostgreSQL 数据库
- Redis (用于令牌黑名单和速率限制)

### 安装步骤

1. 克隆仓库

```bash
git clone https://github.com/yourusername/authflow.git
cd authflow/ts
```

2. 安装依赖

```bash
yarn install
```

3. 环境配置

```bash
cp .env.example .env.development
```

编辑 `.env.development` 文件，配置数据库连接和其他必要参数。

4. 数据库迁移

```bash
yarn prisma:migrate
yarn prisma:seed
```

5. 启动开发服务器

```bash
yarn dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 环境配置

项目支持多环境配置，通过不同的 `.env` 文件管理：

- `.env.development` - 开发环境配置
- `.env.test` - 测试环境配置
- `.env.production` - 生产环境配置

关键配置项包括：

```
# JWT配置
SECRET_KEY=your_secret_key
REFRESH_SECRET_KEY=your_refresh_secret_key
ALGORITHM=HS256

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/authflow

# 邮件配置
MAIL_USERNAME=your_email@example.com
MAIL_PASSWORD=your_email_password
MAIL_FROM=noreply@example.com

# OAuth配置
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## 项目结构

```
project-root/
├── pages/api/v1/         # API 路由
│   ├── public/           # 公共端点
│   ├── auth/             # 认证管理
│   ├── users/            # 用户资源
│   ├── 2fa/              # 两步验证
│   ├── sso/              # 单点登录
│   └── health.ts         # 健康检查
├── src/
│   ├── services/         # 业务逻辑服务
│   ├── middleware/       # 中间件
│   ├── lib/              # 工具库
│   ├── types/            # 类型定义
│   └── utils/            # 工具函数
├── prisma/               # 数据库模型和迁移
└── __tests__/            # 测试文件
```

## API 文档

系统提供了完整的 API 文档，可通过以下方式访问：

1. 启动开发服务器后访问 `/api-docs` 路径查看 Swagger UI 文档
2. 查看 `docs/apis.md` 获取详细的 API 说明

所有 API 端点均位于 `/api/v1` 路径下，分为以下几类：

- 公共端点 (`/public/*`) - 无需认证
- 认证管理 (`/auth/*`) - 令牌相关操作
- 用户资源 (`/users/*`) - 需要认证
- 两步验证 (`/2fa/*`) - 2FA 相关操作
- 单点登录 (`/sso/*`) - 第三方登录
- 健康检查 (`/health`) - 系统状态

## 测试

项目使用 Jest 进行单元测试和集成测试：

```bash
# 运行所有测试
yarn test

# 运行特定测试
yarn test -- -t "auth service"
```

## 部署

### 生产环境构建

```bash
yarn build
```

### 启动生产服务器

```bash
yarn start
```

### Vercel 部署

项目可以直接部署到 Vercel 平台：

1. 在 Vercel 上导入项目
2. 配置环境变量
3. 部署应用

## 贡献指南

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

[MIT](LICENSE)

## 联系方式

如有问题或建议，请通过 Issues 提交或联系项目维护者。
