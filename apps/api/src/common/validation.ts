import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

// Agrupa los errores por campo para que el frontend los muestre junto a cada uno (HU-001 CA4).
// Respuesta: { message, errors: { email: ['...'], password: ['...'] } }
export const toFieldErrors = (errors: ValidationError[], parent = ''): Record<string, string[]> =>
  errors.reduce<Record<string, string[]>>((acc, error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) acc[field] = Object.values(error.constraints);
    return { ...acc, ...toFieldErrors(error.children ?? [], field) };
  }, {});

export const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  stopAtFirstError: true,
  exceptionFactory: (errors) =>
    new BadRequestException({
      message: 'Revisa los campos marcados',
      errors: toFieldErrors(errors),
    }),
});
