import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor } from './cursor.js';

describe('cursor', () => {
  it('decodes what it encodes', () => {
    const cursor = { createdAt: new Date('2026-11-20T10:00:00.000Z'), id: '6740a1b2c3d4e5f6a7b8c9d0' };

    const decoded = decodeCursor(encodeCursor(cursor));

    expect(decoded).toEqual(cursor);
  });

  it('rejects values that are not base64url json', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow(BadRequestException);
  });

  it('rejects cursors with an invalid id', () => {
    const forged = Buffer.from(JSON.stringify({ c: '2026-11-20T10:00:00.000Z', i: 'abc' })).toString('base64url');

    expect(() => decodeCursor(forged)).toThrow(BadRequestException);
  });

  it('rejects cursors with an invalid date', () => {
    const forged = Buffer.from(JSON.stringify({ c: 'yesterday', i: '6740a1b2c3d4e5f6a7b8c9d0' })).toString('base64url');

    expect(() => decodeCursor(forged)).toThrow(BadRequestException);
  });
});
