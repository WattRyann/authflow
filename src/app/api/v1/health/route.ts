import { NextResponse } from 'next/server';
import { HealthService } from '@/services/healthService';

export async function GET() {
  try {
    const healthService = new HealthService();
    const healthStatus = await healthService.check();

    if (healthStatus.status === 'error') {
      return NextResponse.json(healthStatus, { status: 503 });
    }

    return NextResponse.json(healthStatus);
  } catch {
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