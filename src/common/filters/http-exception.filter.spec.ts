import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MongoServerError } from 'mongodb';
import { isUnexpectedError, resolveError } from './http-exception.filter.js';

describe('resolveError', () => {
  it('keeps status and message from http exceptions', () => {
    const resolved = resolveError(new NotFoundException('Order not found'));

    expect(resolved).toEqual({ statusCode: 404, error: 'NOT_FOUND', message: 'Order not found' });
  });

  it('keeps the list of validation messages', () => {
    const resolved = resolveError(new BadRequestException(['name must be a string', 'qty must be positive']));

    expect(resolved.message).toEqual(['name must be a string', 'qty must be positive']);
  });

  it('maps duplicate key errors to 409', () => {
    const resolved = resolveError(new MongoServerError({ message: 'E11000 duplicate key', code: 11000 }));

    expect(resolved).toEqual({ statusCode: 409, error: 'CONFLICT', message: 'Resource already exists' });
  });

  it('maps query time limit errors to 503', () => {
    const resolved = resolveError(new MongoServerError({ message: 'operation exceeded time limit', code: 50 }));

    expect(resolved).toEqual({
      statusCode: 503,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Query time limit exceeded',
    });
  });

  it('hides unexpected errors behind a 500', () => {
    const resolved = resolveError(new Error('database password is wrong'));

    expect(resolved).toEqual({ statusCode: 500, error: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' });
  });
});

describe('isUnexpectedError', () => {
  it('treats http and duplicate key errors as expected', () => {
    expect(isUnexpectedError(new NotFoundException())).toBe(false);
    expect(isUnexpectedError(new MongoServerError({ message: 'dup', code: 11000 }))).toBe(false);
  });

  it('treats any other error as unexpected', () => {
    expect(isUnexpectedError(new Error('boom'))).toBe(true);
  });
});
