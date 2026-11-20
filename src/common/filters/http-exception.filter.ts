import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { MongoServerError } from 'mongodb';

const DUPLICATE_KEY_ERROR_CODE = 11000;
const MAX_TIME_MS_EXPIRED_ERROR_CODE = 50;

export type ErrorResponseBody = {
  readonly statusCode: number;
  readonly error: string;
  readonly message: string | string[];
  readonly path: string;
  readonly timestamp: string;
};

type ResolvedError = Pick<ErrorResponseBody, 'statusCode' | 'error' | 'message'>;

function hasMessage(value: unknown): value is { message: string | string[] } {
  if (typeof value !== 'object' || value === null || !('message' in value)) {
    return false;
  }
  return typeof value.message === 'string' || Array.isArray(value.message);
}

function resolveHttpException(exception: HttpException): ResolvedError {
  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  return {
    statusCode,
    error: HttpStatus[statusCode] ?? 'Error',
    message: hasMessage(response) ? response.message : exception.message,
  };
}

function isMongoError(exception: unknown, code: number): boolean {
  return exception instanceof MongoServerError && exception.code === code;
}

export function isUnexpectedError(exception: unknown): boolean {
  if (exception instanceof HttpException) {
    return false;
  }
  return !isMongoError(exception, DUPLICATE_KEY_ERROR_CODE) && !isMongoError(exception, MAX_TIME_MS_EXPIRED_ERROR_CODE);
}

export function resolveError(exception: unknown): ResolvedError {
  if (exception instanceof HttpException) {
    return resolveHttpException(exception);
  }
  if (isMongoError(exception, DUPLICATE_KEY_ERROR_CODE)) {
    return { statusCode: HttpStatus.CONFLICT, error: 'CONFLICT', message: 'Resource already exists' };
  }
  if (isMongoError(exception, MAX_TIME_MS_EXPIRED_ERROR_CODE)) {
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Query time limit exceeded',
    };
  }
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    if (isUnexpectedError(exception)) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    const resolved = resolveError(exception);
    const body: ErrorResponseBody = {
      ...resolved,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(resolved.statusCode).json(body);
  }
}
