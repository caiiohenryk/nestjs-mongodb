import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

const ETAG_PATTERN = /^(?:W\/)?"(\d{1,16})"$/;

export function toOrderEtag(updatedAt: string): string {
  return `"${new Date(updatedAt).getTime()}"`;
}

@Injectable()
export class IfMatchPipe implements PipeTransform<string | undefined, Date | undefined> {
  transform(value: string | undefined): Date | undefined {
    if (value === undefined || value.trim() === '*') {
      return undefined;
    }
    const match = ETAG_PATTERN.exec(value.trim());
    if (match?.[1] === undefined) {
      throw new BadRequestException('If-Match must be an ETag returned by this API');
    }
    return new Date(Number(match[1]));
  }
}
