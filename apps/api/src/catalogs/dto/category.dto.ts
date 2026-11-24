import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// Una descripción vacía se guarda como null.
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

// HU-037 CA1: nombre y descripción.
export class CreateCategoryDto {
  @Transform(trim)
  @IsString({ message: 'Escribe el nombre de la categoría' })
  @Length(3, 100, { message: 'El nombre debe tener entre 3 y 100 caracteres' })
  name!: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'Descripción inválida' })
  @MaxLength(300, { message: 'La descripción admite hasta 300 caracteres' })
  description?: string | null;
}

// HU-037 CA1 y CA2: editar o activar/desactivar. Solo cambia lo que se envía.
export class UpdateCategoryDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Escribe el nombre de la categoría' })
  @Length(3, 100, { message: 'El nombre debe tener entre 3 y 100 caracteres' })
  name?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'Descripción inválida' })
  @MaxLength(300, { message: 'La descripción admite hasta 300 caracteres' })
  description?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'Indica si la categoría queda activa' })
  isActive?: boolean;
}
