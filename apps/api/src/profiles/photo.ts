import { BadRequestException, ParseFilePipeBuilder } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

// RNF-REN-07: imágenes JPG, PNG o WebP de hasta 5 MiB. Compartido por los perfiles de trabajador y publicador.
export type UploadedPhoto = { buffer: Buffer; mimetype: string };

// Busboy corta el archivo al alcanzar el límite. Una imagen de exactamente 5 MiB es válida.
export const photoInterceptor = (fields: number) =>
  FileInterceptor('photo', {
    limits: { fileSize: 5 * 1024 * 1024 + 1, files: 1, fields, fieldSize: 4096 },
  });

export const photoPipe = () =>
  new ParseFilePipeBuilder()
    .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/, overrideMimeType: true })
    .build({
      exceptionFactory: () =>
        new BadRequestException({
          errors: { photo: ['Selecciona una imagen JPG, PNG o WebP válida.'] },
        }),
    });
