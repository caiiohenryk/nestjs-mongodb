import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

@Injectable()
export class IdempotencyKeyPipe implements PipeTransform<string | undefined, string | undefined> {
  transform(value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
      throw new BadRequestException('Idempotency-Key must have 8 to 128 letters, digits, dashes or underscores');
    }
    return value;
  }
}
