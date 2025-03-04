import { NextResponse } from 'next/server';
import { getApiDocs } from '@/utils/swagger';

/**
 * @swagger
 * /api/swagger:
 *   get:
 *     description: 获取API文档的Swagger规范
 *     responses:
 *       200:
 *         description: 返回完整的Swagger规范JSON
 */
export async function GET() {
  const spec = getApiDocs();
  return NextResponse.json(spec);
}