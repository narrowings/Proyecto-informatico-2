import { ApplicationStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/http/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// HU-005 CA4: mensaje opcional al postularse a una vacante formal.
export class ApplyDto {
  @IsOptional()
  @Transform(trim)
  @MaxLength(1000, { message: 'El mensaje admite máximo 1000 caracteres' })
  @IsString({ message: 'El mensaje debe ser texto' })
  message?: string;
}

// HU-013 CA1: "Postulaciones activas" (recibidas, en revisión o en entrevista) o todas.
export class ListMyApplicationsQuery extends PaginationDto {
  @IsOptional()
  @IsIn(['active', 'all'], { message: 'El estado debe ser active o all' })
  state: 'active' | 'all' = 'active';
}

// HU-005 CA2: el frontend marca "Postulado" en las tarjetas que ve (máx. 50 por consulta).
export class ApplicationStatusQuery {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsUUID('4', { each: true, message: 'Identificador de oportunidad inválido' })
  @ArrayMaxSize(50, { message: 'Máximo 50 oportunidades por consulta' })
  opportunityIds!: string[];
}

// HU-024 CA2: estados que el publicador asigna a un postulante de vacante formal.
export const PUBLISHER_STATUSES = [
  ApplicationStatus.IN_REVIEW,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.REJECTED,
] as const;

export class ChangeApplicationStatusDto {
  @IsIn(PUBLISHER_STATUSES, { message: 'Elige En revisión, Entrevista, Aceptada o Rechazada' })
  status!: (typeof PUBLISHER_STATUSES)[number];
}
