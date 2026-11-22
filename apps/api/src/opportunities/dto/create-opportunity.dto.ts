import { OpportunityType, WorkModality, WorkSchedule } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const MAX_PAYMENT_COP = 100_000_000;
export const MAX_PEOPLE_NEEDED = 50;
// Un año: suficiente para proyectos largos sin aceptar valores absurdos.
export const MAX_DURATION_MINUTES = 365 * 24 * 60;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export const isFormal = (dto: { type?: OpportunityType }) =>
  dto.type === OpportunityType.FORMAL_JOB;
const isTaskLike = (dto: { type?: OpportunityType }) =>
  dto.type !== undefined && dto.type !== OpportunityType.FORMAL_JOB;

// Se registran en el orden en que deben evaluarse: primero el tipo, luego los límites.
const money = (message: string) => [
  IsInt({ message }),
  Min(1, { message }),
  Max(MAX_PAYMENT_COP, { message: 'El valor es demasiado alto' }),
];
const apply =
  (decorators: PropertyDecorator[]): PropertyDecorator =>
  (target, key) => {
    for (const decorator of decorators) decorator(target, key);
  };

// HU-025 CA1–CA2, HU-003 (RF-03-02) y HU-024 CA1 (RF-03-03). Un solo DTO con validación según el tipo:
// los campos del otro tipo se ignoran. Como en RegisterDto, IsNotEmpty va al final.
export class CreateOpportunityDto {
  @IsEnum(OpportunityType, { message: 'Elige el tipo de oportunidad' })
  type!: OpportunityType;

  @Transform(trim)
  @MaxLength(120, { message: 'El título admite máximo 120 caracteres' })
  @MinLength(5, { message: 'El título debe tener al menos 5 caracteres' })
  @IsString()
  @IsNotEmpty({ message: 'Escribe la actividad o el cargo' })
  title!: string;

  @Transform(trim)
  @MaxLength(3000, { message: 'La descripción admite máximo 3000 caracteres' })
  @MinLength(20, { message: 'Describe la oportunidad con al menos 20 caracteres' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  description!: string;

  @Min(1, { message: 'Elige una categoría' })
  @IsInt({ message: 'Elige una categoría' })
  categoryId!: number;

  // RF-03-04: solo la zona o barrio; la dirección exacta nunca se pide al publicar.
  @Min(1, { message: 'Elige la zona de Cali' })
  @IsInt({ message: 'Elige la zona de Cali' })
  zoneId!: number;

  // ─── Tareas, trabajos rápidos, proyectos y servicios (RF-03-02) ───
  @ValidateIf(isTaskLike)
  @Max(MAX_PEOPLE_NEEDED, { message: `Máximo ${MAX_PEOPLE_NEEDED} personas por publicación` })
  @Min(1, { message: 'Indica cuántas personas necesitas' })
  @IsInt({ message: 'Indica cuántas personas necesitas' })
  peopleNeeded?: number;

  @ValidateIf(isTaskLike)
  @apply(money('Indica el pago ofrecido en pesos, mayor que cero'))
  paymentCop?: number;

  @ValidateIf(isTaskLike)
  @IsISO8601({ strict: true }, { message: 'Indica la fecha y hora de realización' })
  scheduledAt?: string;

  @ValidateIf(isTaskLike)
  @Max(MAX_DURATION_MINUTES, { message: 'La duración máxima es de un año' })
  @Min(15, { message: 'La duración mínima es de 15 minutos' })
  @IsInt({ message: 'Indica la duración' })
  durationMinutes?: number;

  @IsOptional()
  @Transform(trim)
  @MaxLength(1000, { message: 'Las condiciones admiten máximo 1000 caracteres' })
  @IsString()
  conditions?: string;

  // ─── Vacante formal (RF-03-03) ───
  @ValidateIf(isFormal)
  @apply(money('Indica el salario en pesos, mayor que cero'))
  salaryMinCop?: number;

  // Opcional: si falta, el salario es un valor fijo (salaryMinCop).
  @ValidateIf((dto: CreateOpportunityDto) => isFormal(dto) && dto.salaryMaxCop !== undefined)
  @apply(money('Indica el salario máximo en pesos, mayor que cero'))
  salaryMaxCop?: number;

  @ValidateIf(isFormal)
  @IsEnum(WorkModality, { message: 'Elige la modalidad' })
  modality?: WorkModality;

  @ValidateIf(isFormal)
  @IsEnum(WorkSchedule, { message: 'Elige la jornada' })
  schedule?: WorkSchedule;

  @ValidateIf(isFormal)
  @Transform(trim)
  @MaxLength(500, { message: 'La experiencia admite máximo 500 caracteres' })
  @IsString()
  @IsNotEmpty({ message: 'Indica la experiencia requerida' })
  experienceRequired?: string;

  @ValidateIf(isFormal)
  @Transform(trim)
  @MaxLength(2000, { message: 'Los requisitos admiten máximo 2000 caracteres' })
  @IsString()
  @IsNotEmpty({ message: 'Indica los requisitos' })
  requirements?: string;

  @ValidateIf(isFormal)
  @IsISO8601({ strict: true }, { message: 'Indica la fecha de cierre de la vacante' })
  closesAt?: string;

  // HU-003 CA2: true cuando el publicador leyó la advertencia de relación laboral.
  @IsOptional()
  @IsBoolean()
  acknowledgeLaborWarning?: boolean;
}
