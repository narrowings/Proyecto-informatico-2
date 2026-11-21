import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// HU-023 CA3: pausar, cerrar o cancelar exige un motivo.
export class ChangeStatusDto {
  @Transform(trim)
  @MaxLength(500, { message: 'El motivo admite máximo 500 caracteres' })
  @MinLength(5, { message: 'Escribe un motivo de al menos 5 caracteres' })
  @IsString()
  @IsNotEmpty({ message: 'Escribe el motivo' })
  reason!: string;
}
