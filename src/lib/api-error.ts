import { NextResponse } from 'next/server';

/**
 * Standard API error response envelope.
 *
 * Every error from an API route should use this shape so clients can
 * rely on a single `{ error, details?, code? }` contract.
 */
export interface ApiError {
  error: string;
  details?: string;
  code?: string;
}

/** Return a typed JSON error response */
export function apiError(
  message: string,
  status: number,
  opts?: { details?: string; code?: string },
): NextResponse<ApiError> {
  const body: ApiError = { error: message };
  if (opts?.details) body.details = opts.details;
  if (opts?.code) body.code = opts.code;
  return NextResponse.json(body, { status });
}

/** Extract a human-readable message from an unknown catch value */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}
