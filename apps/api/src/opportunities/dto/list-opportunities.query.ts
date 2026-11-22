import { OpportunityType, WorkModality, WorkSchedule } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAX_PAGE_SIZE = 50;

// Los parámetros de la URL llegan como texto.
const toInt = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value) : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// HU-009 (feed de empleo formal, Modo A) y HU-010 (búsqueda y filtros combinables, RF-04-08 a 11).
// mode=formal: vacantes formales. mode=tasks: tareas, trabajos rápidos, proyectos y servicios.
export class ListOpportunitiesQuery {
  @IsIn(['formal', 'tasks'], { message: 'El modo debe ser formal o tasks' })
  mode!: 'formal' | 'tasks';

  @IsOptional()
  @Transform(trim)
  @MaxLength(100, { message: 'La búsqueda admite máximo 100 caracteres' })
  @IsString()
  q?: string;

  // Dentro de mode=tasks, para elegir solo un tipo.
  @IsOptional()
  @IsEnum(OpportunityType, { message: 'Tipo de oportunidad inválido' })
  type?: OpportunityType;

  @IsOptional()
  @Transform(toInt)
  @Min(1)
  @IsInt({ message: 'Categoría inválida' })
  categoryId?: number;

  @IsOptional()
  @Transform(toInt)
  @Min(1)
  @IsInt({ message: 'Zona inválida' })
  zoneId?: number;

  // Modo A (RF-04-09).
  @IsOptional()
  @IsEnum(WorkModality, { message: 'Modalidad inválida' })
  modality?: WorkModality;

  @IsOptional()
  @IsEnum(WorkSchedule, { message: 'Jornada inválida' })
  schedule?: WorkSchedule;

  @IsOptional()
  @Transform(toInt)
  @Min(0)
  @IsInt({ message: 'Salario mínimo inválido' })
  salaryMin?: number;

  @IsOptional()
  @Transform(toInt)
  @Min(0)
  @IsInt({ message: 'Salario máximo inválido' })
  salaryMax?: number;

  // Modo B (RF-04-10).
  @IsOptional()
  @Transform(toInt)
  @Min(0)
  @IsInt({ message: 'Pago mínimo inválido' })
  paymentMin?: number;

  @IsOptional()
  @Transform(toInt)
  @Min(0)
  @IsInt({ message: 'Pago máximo inválido' })
  paymentMax?: number;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Fecha inicial inválida' })
  dateFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Fecha final inválida' })
  dateTo?: string;

  @IsOptional()
  @Transform(toInt)
  @Min(1)
  @IsInt({ message: 'Duración máxima inválida' })
  durationMax?: number;

  @IsOptional()
  @Transform(toInt)
  @Min(1)
  @IsInt({ message: 'Página inválida' })
  page?: number;

  @IsOptional()
  @Transform(toInt)
  @Max(MAX_PAGE_SIZE, { message: `Máximo ${MAX_PAGE_SIZE} resultados por página` })
  @Min(1)
  @IsInt({ message: 'Tamaño de página inválido' })
  pageSize?: number;
}

export class PageQuery {
  @IsOptional()
  @Transform(toInt)
  @Min(1)
  @IsInt({ message: 'Página inválida' })
  page?: number;

  @IsOptional()
  @Transform(toInt)
  @Max(MAX_PAGE_SIZE, { message: `Máximo ${MAX_PAGE_SIZE} resultados por página` })
  @Min(1)
  @IsInt({ message: 'Tamaño de página inválido' })
  pageSize?: number;
}
