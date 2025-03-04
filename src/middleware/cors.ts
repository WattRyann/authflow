// 从 next/types 导入类型定义，避免找不到模块的问题
import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

const handler = createRouter<NextApiRequest, NextApiResponse>()
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