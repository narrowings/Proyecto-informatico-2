import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccountStatus, ReportStatus, ReportTargetType } from '@prisma/client';
import { PaginationDto } from '../common/http/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ModerationReasonDto {
  @Transform(trim)
  @IsString({ message: 'Indica el motivo de la decisión' })
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  @MaxLength(500, { message: 'El motivo admite máximo 500 caracteres' })
  reason!: string;
}

export class ListReportsQuery extends PaginationDto {
  @IsOptional()
  @IsEnum(ReportStatus, { message: 'El estado no es válido' })
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportTargetType, { message: 'El tipo de elemento no es válido' })
  targetType?: ReportTargetType;
}

export class ListUsersQuery extends PaginationDto {
  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  @MaxLength(100, { message: 'La búsqueda admite máximo 100 caracteres' })
  q?: string;

  @IsOptional()
  @IsEnum(AccountStatus, { message: 'El estado no es válido' })
  status?: AccountStatus;
}
