import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = () => {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'AuthFlow API Documentation',
        version: '1.0.0',
        description: '认证流程服务API文档',
        contact: {
          name: 'API Support',
          email: 'support@example.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: 'http://localhost:3000/api',
          description: '开发环境'
        }
      ],
      tags: [
        { name: 'Health', description: '健康检查相关接口' },
        { name: 'Auth', description: '认证相关接口' },
        { name: 'Users', description: '用户相关接口' }
      ],
      components: {
        schemas: {
          Error: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['error'] },
              data: { type: 'null' },
              message: { type: 'string' },
              code: { type: 'string' }
            }
          },
          HealthCheckResponse: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success', 'error'] },
              data: {
                type: 'object',
                properties: {
                  overall: { type: 'string' },
                  database: { type: 'string' },
                  cache: { type: 'string' }
                }
              },
              message: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        },
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    }
  });
  return spec;
};