import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ReportReason, ReportTargetType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateReportDto {
  @IsEnum(ReportTargetType, { message: 'El tipo de reporte no es válido' })
  targetType!: ReportTargetType;

  @IsUUID('4', { message: 'El identificador debe ser un UUID válido' })
  targetId!: string;

  @IsOptional()
  @IsEnum(['PUBLISHER', 'WORKER'], { message: 'El tipo de perfil no es válido' })
  profileKind?: 'PUBLISHER' | 'WORKER';

  @IsEnum(ReportReason, { message: 'El motivo del reporte no es válido' })
  reason!: ReportReason;

  @Transform(trim)
  @ValidateIf(
    (dto: CreateReportDto) => dto.reason === ReportReason.OTHER || dto.description !== undefined,
  )
  @IsString({ message: 'Describe el reporte' })
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres' })
  @MaxLength(1000, { message: 'La descripción admite máximo 1000 caracteres' })
  description?: string;
}
