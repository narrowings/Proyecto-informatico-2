import type { PipeTransform, Type } from '@nestjs/common';
import { validationPipe } from '../validation';

export function validarDto<T>(metatype: Type<T>): PipeTransform {
  return {
    transform: (valor: unknown, metadata) =>
      validationPipe.transform(valor, { ...metadata, metatype }),
  };
}
