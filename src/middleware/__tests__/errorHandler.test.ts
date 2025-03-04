import { NextResponse } from 'next/server';
import { APIError, handleError } from '../errorHandler';
import { ErrorCodes } from '@/types/api';

// Mock NextResponse.json
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((body, init) => ({
      body,
      ...init
    }))
  }
}));

describe('handleError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该正确处理 APIError', () => {
    const apiError = new APIError(
      400,
      ErrorCodes.INVALID_INPUT,
      '无效输入',
      { field: 'username' }
    );

    handleError(apiError);

    expect(NextResponse.json).toHaveBeenCalledWith(
      {
        status: 'error',
        data: { field: 'username' },
        message: '无效输入',
        code: ErrorCodes.INVALID_INPUT
      },
      { status: 400 }
    );
  });

  it('应该将非 Error 实例转换为 Error', () => {
    handleError('字符串错误');

    expect(NextResponse.json).toHaveBeenCalledWith(
      {
        status: 'error',
        data: null,
        message: 'Internal Server Error',
        code: ErrorCodes.INTERNAL_SERVER_ERROR
      },
      { status: 500 }
    );
  });

  it('应该处理普通 Error', () => {
    const error = new Error('普通错误');
    handleError(error);

    expect(NextResponse.json).toHaveBeenCalledWith(
      {
        status: 'error',
        data: null,
        message: 'Internal Server Error',
        code: ErrorCodes.INTERNAL_SERVER_ERROR
      },
      { status: 500 }
    );
  });

  it('应该处理 null 或 undefined 错误', () => {
    handleError(null);

    expect(NextResponse.json).toHaveBeenCalledWith(
      {
        status: 'error',
        data: null,
        message: 'Internal Server Error',
        code: ErrorCodes.INTERNAL_SERVER_ERROR
      },
      { status: 500 }
    );
  });

  it('应该处理包含完整错误信息的 APIError', () => {
    const apiError = new APIError(
      429,
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      '请求过于频繁',
      { retryAfter: 60 }
    );

    handleError(apiError);

    expect(NextResponse.json).toHaveBeenCalledWith(
      {
        status: 'error',
        data: { retryAfter: 60 },
        message: '请求过于频繁',
        code: ErrorCodes.RATE_LIMIT_EXCEEDED
      },
      { status: 429 }
    );
  });
});