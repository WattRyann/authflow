import { NextResponse } from 'next/server';
import { HealthService } from '@/services/healthService';

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: 系统健康检查
 *     description: 检查系统各组件（数据库、缓存等）的健康状态
 *     responses:
 *       200:
 *         description: 所有系统组件正常运行
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheckResponse'
 *       503:
 *         description: 一个或多个系统组件不可用
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET() {
  try {
    const healthService = new HealthService();
    const healthStatus = await healthService.check();

    if (healthStatus.status === 'error') {
      return NextResponse.json(healthStatus, { status: 503 });
    }

    return NextResponse.json(healthStatus);
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        data: { component: 'server', reason: 'Internal error' },
        message: 'Service unavailable',
        code: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}