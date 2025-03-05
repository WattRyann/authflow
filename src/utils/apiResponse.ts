import { NextResponse } from 'next/server';
import { APIResponse, ErrorCodes } from '@/types/api';

export function jsonError(message: string, code: ErrorCodes, status: number): NextResponse<APIResponse<null>> {
  return NextResponse.json({
    status: 'error',
    data: null,
    message,
    code,
  }, { status });
}

export function jsonSuccess<T>(data: T | null, message: string): NextResponse<APIResponse<T>> {
  return NextResponse.json({
    status: 'success',
    data,
    message,
  }, { status: 200 });
}