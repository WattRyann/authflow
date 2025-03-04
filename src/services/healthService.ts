import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import defaultPrisma from '@/lib/prisma';

interface HealthStatus {
  overall: string;
  database: string;
  cache: string;
}

interface HealthCheckResponse {
  status: string;
  data: HealthStatus | { component: string; reason: string };
  message: string;
  code?: string;
  timestamp: string;
}

export class HealthService {
  constructor(
    private redis: Redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379'),
    private prisma: PrismaClient = defaultPrisma
  ) {}

  private async checkDatabase(): Promise<string> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkCache(): Promise<string> {
    try {
      await this.redis.ping();
      return 'ok';
    } catch (error) { // eslint-disable-line @typescript-eslint/no-unused-vars
      return 'error';
    }
  }

  public async check(): Promise<HealthCheckResponse> {
    const dbStatus = await this.checkDatabase();
    const cacheStatus = await this.checkCache();
    const overall = dbStatus === 'ok' && cacheStatus === 'ok' ? 'healthy' : 'unhealthy';

    if (overall === 'healthy') {
      return {
        status: 'success',
        data: {
          overall,
          database: dbStatus,
          cache: cacheStatus
        },
        message: 'Service is operational',
        timestamp: new Date().toISOString()
      };
    } else {
      const failedComponent = dbStatus === 'error' ? 'database' : 'cache';
      return {
        status: 'error',
        data: {
          component: failedComponent,
          reason: 'Connection failed'
        },
        message: 'Service unavailable',
        code: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      };
    }
  }
}