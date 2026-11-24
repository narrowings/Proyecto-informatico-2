import { Transform } from 'class-transformer';
import { IsBoolean, IsObject, IsOptional, IsString, Length } from 'class-validator';

// HU-003 CA2 / RF-03-05: el administrador ajusta el texto, los umbrales y si la regla está activa.
// Los códigos son fijos (cada uno tiene su evaluador en labor-warnings.ts): no se crean ni se borran.
export class UpdateLaborWarningRuleDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Escribe el texto de la advertencia' })
  @Length(20, 1000, { message: 'El texto debe tener entre 20 y 1000 caracteres' })
  message?: string;

  @IsOptional()
  @IsBoolean({ message: 'Indica si la regla queda activa' })
  isActive?: boolean;

  // Se valida según el código de la regla en el servicio.
  @IsOptional()
  @IsObject({ message: 'Parámetros inválidos' })
  params?: Record<string, unknown>;
}
