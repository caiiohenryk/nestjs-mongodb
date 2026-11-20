import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function isObjectIdString(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
}

@Injectable()
export class ObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isObjectIdString(value)) {
      throw new BadRequestException(`'${value}' is not a valid id`);
    }
    return value.toLowerCase();
  }
}
