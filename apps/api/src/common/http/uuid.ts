import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

export const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      message: 'Revisa los campos marcados',
      errors: { id: ['El identificador debe ser un UUID válido'] },
    }),
});
