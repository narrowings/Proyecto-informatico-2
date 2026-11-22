import { PartialType } from '@nestjs/mapped-types';
import { WorkerAvailability } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { CreateWorkerProfileDto } from './create-worker-profile.dto';

// HU-032 CA1–CA2 y HU-030 CA4: los campos que no se envían quedan igual. La foto se cambia aparte
// (PUT /v1/profiles/worker/me/photo) porque llega como archivo.
export class UpdateWorkerProfileDto extends PartialType(CreateWorkerProfileDto) {
  @IsOptional()
  @IsEnum(WorkerAvailability, { message: 'Elige Disponible o No disponible' })
  availability?: WorkerAvailability;

  @IsOptional()
  @IsBoolean({ message: 'Indica si quieres mostrar tu foto' })
  showPhoto?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Indica si quieres mostrar tu experiencia' })
  showExperience?: boolean;
}
