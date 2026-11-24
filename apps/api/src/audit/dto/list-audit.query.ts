import { AuditAction } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/http/pagination.dto';

// HU-038 CA2: filtros por fecha (desde/hasta, ISO 8601), usuario y tipo de evento.
export class ListAuditQuery extends PaginationDto {
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Fecha inicial inválida' })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Fecha final inválida' })
  to?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Usuario inválido' })
  actorUserId?: string;

  @IsOptional()
  @IsEnum(AuditAction, { message: 'Tipo de evento inválido' })
  action?: AuditAction;
}
