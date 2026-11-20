import { BadRequestException } from '@nestjs/common';
import { isObjectIdString } from '../pipes/object-id.pipe.js';

export type Cursor = {
  readonly createdAt: Date;
  readonly id: string;
};

type EncodedCursor = {
  readonly c: string;
  readonly i: string;
};

function isEncodedCursor(value: unknown): value is EncodedCursor {
  if (typeof value !== 'object' || value === null || !('c' in value) || !('i' in value)) {
    return false;
  }
  return typeof value.c === 'string' && typeof value.i === 'string';
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function encodeCursor(cursor: Cursor): string {
  const encoded: EncodedCursor = { c: cursor.createdAt.toISOString(), i: cursor.id };
  return Buffer.from(JSON.stringify(encoded)).toString('base64url');
}

export function decodeCursor(value: string): Cursor {
  const parsed = parseJson(value);
  if (!isEncodedCursor(parsed)) {
    throw new BadRequestException('Invalid cursor');
  }
  const createdAt = new Date(parsed.c);
  if (Number.isNaN(createdAt.getTime()) || !isObjectIdString(parsed.i)) {
    throw new BadRequestException('Invalid cursor');
  }
  return { createdAt, id: parsed.i };
}
