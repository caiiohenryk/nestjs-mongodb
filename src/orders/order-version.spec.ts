import { BadRequestException } from '@nestjs/common';
import { IfMatchPipe, toOrderEtag } from './order-version.js';

describe('order version', () => {
  const pipe = new IfMatchPipe();

  it('turns updatedAt into a quoted etag', () => {
    expect(toOrderEtag('2026-11-20T10:00:00.000Z')).toBe('"1795168800000"');
  });

  it('parses strong and weak etags back into the version date', () => {
    expect(pipe.transform('"1795168800000"')).toEqual(new Date('2026-11-20T10:00:00.000Z'));
    expect(pipe.transform('W/"1795168800000"')).toEqual(new Date('2026-11-20T10:00:00.000Z'));
  });

  it('treats a missing header and the wildcard as no precondition', () => {
    expect(pipe.transform(undefined)).toBeUndefined();
    expect(pipe.transform('*')).toBeUndefined();
  });

  it('rejects malformed etags', () => {
    expect(() => pipe.transform('abc')).toThrow(BadRequestException);
  });
});
