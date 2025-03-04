import { HealthService } from '../healthService';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// 模拟依赖
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock('ioredis');

describe('HealthService', () => {
  let healthService: HealthService;
  let mockRedis: jest.Mocked<Redis>;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // 清除所有模拟的实现
    jest.clearAllMocks();

    // 设置 Redis 模拟
    mockRedis = {
      ping: jest.fn(),
    } as unknown as jest.Mocked<Redis>;
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

    // 创建服务实例
    healthService = new HealthService(mockRedis, mockPrisma);
  });

  describe('check', () => {
    it('应该在所有服务正常时返回健康状态', async () => {
      // 设置模拟响应
      mockRedis.ping.mockResolvedValue('PONG');

      // 执行健康检查
      const result = await healthService.check();

      // 验证结果
      expect(result).toEqual({
        status: 'success',
        data: {
          overall: 'healthy',
          database: 'ok',
          cache: 'ok'
        },
        message: 'Service is operational',
        timestamp: expect.any(String)
      });

      // 验证调用
      expect(mockRedis.ping).toHaveBeenCalled();
      expect(
        (healthService as unknown as { prisma: { $queryRaw: jest.Mock }})
          .prisma.$queryRaw
      ).toHaveBeenCalled();
    });

    it('应该在数据库连接失败时返回不健康状态', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      (healthService as unknown as { prisma: { $queryRaw: jest.Mock }})
        .prisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      // 执行健康检查
      const result = await healthService.check();

      // 验证结果
      expect(result).toEqual({
        status: 'error',
        data: {
          component: 'database',
          reason: 'Connection failed'
        },
        message: 'Service unavailable',
        code: 'SERVICE_UNAVAILABLE',
        timestamp: expect.any(String)
      });
    });

    it('应该在缓存连接失败时返回不健康状态', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));
      (healthService as unknown as { prisma: { $queryRaw: jest.Mock }})
        .prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      // 执行健康检查
      const result = await healthService.check();

      // 验证结果
      expect(result).toEqual({
        status: 'error',
        data: {
          component: 'cache',
          reason: 'Connection failed'
        },
        message: 'Service unavailable',
        code: 'SERVICE_UNAVAILABLE',
        timestamp: expect.any(String)
      });
    });

    it('应该在所有服务都失败时返回不健康状态', async () => {
      // 设置模拟响应
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));
      (healthService as unknown as { prisma: { $queryRaw: jest.Mock }})
        .prisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      // 执行健康检查
      const result = await healthService.check();

      // 验证结果
      expect(result).toEqual({
        status: 'error',
        data: {
          component: 'database',
          reason: 'Connection failed'
        },
        message: 'Service unavailable',
        code: 'SERVICE_UNAVAILABLE',
        timestamp: expect.any(String)
      });
    });
  });
});