import { NextResponse } from 'next/server';
import { ErrorCodes, APIResponse } from '../types/api';

/**
 * Custom error class for API responses.
 * Extends the built-in Error class to include HTTP status, error code, and additional data.
 */
export class APIError extends Error {
  public statusCode: number;
  public code: ErrorCodes;
  public data?: any;

  /**
   * Creates an instance of APIError.
   * @param statusCode - The HTTP status code associated with the error.
   * @param code - A specific error code to identify the error.
   * @param message - A descriptive error message.
   * @param data - Optional additional data related to the error.
   */
  constructor(statusCode: number, code: ErrorCodes, message: string, data?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.data = data;
    this.name = 'APIError';

    // Ensure the proper prototype chain is set for correct instanceof checks.
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Handles errors and returns a standardized JSON response.
 * Differentiates between known API errors and unexpected errors,
 * providing detailed error messages in development mode.
 *
 * @param error - The error that occurred.
 * @returns A NextResponse containing the APIResponse with error details.
 */
export function handleError(error: unknown): NextResponse<APIResponse<null>> {
  let response: APIResponse<null>;
  let status: number;
  
  // Normalize the NODE_ENV value to lowercase for consistent comparisons.
  const env = process.env.NODE_ENV?.toLowerCase();

  if (error instanceof APIError) {
    response = {
      status: 'error',
      data: error.data,
      message: error.message,
      code: error.code,
    };
    status = error.statusCode;
  } else {
    // Log unexpected errors unless running in a test environment to keep test output clean.
    if (env !== 'test') {
      console.error('Unexpected error:', error);
    }

    // In development mode, provide a more detailed error message.
    const isDev = env === 'development';
    const errorMessage = isDev && error instanceof Error ? error.message : 'Internal Server Error';
    
    response = {
      status: 'error',
      data: null,
      message: errorMessage,
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
    };
    status = 500;
  }

  return NextResponse.json(response, { status });
}
