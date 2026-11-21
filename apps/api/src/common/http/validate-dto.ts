import type { PipeTransform, Type } from '@nestjs/common';
import { validationPipe } from '../validation';

export function validateDto<T>(metatype: Type<T>): PipeTransform {
  return {
    transform: (value: unknown, metadata) =>
      validationPipe.transform(value, { ...metadata, metatype }),
  };
}
