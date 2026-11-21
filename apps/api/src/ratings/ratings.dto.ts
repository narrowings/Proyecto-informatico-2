import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CalificacionDto {
  @IsInt({ message: 'El cumplimiento debe ser un entero' })
  @Min(1, { message: 'El cumplimiento mínimo es 1' })
  @Max(5, { message: 'El cumplimiento máximo es 5' })
  fulfillment!: number;

  @IsInt({ message: 'La puntualidad debe ser un entero' })
  @Min(1, { message: 'La puntualidad mínima es 1' })
  @Max(5, { message: 'La puntualidad máxima es 5' })
  punctuality!: number;

  @IsInt({ message: 'La comunicación debe ser un entero' })
  @Min(1, { message: 'La comunicación mínima es 1' })
  @Max(5, { message: 'La comunicación máxima es 5' })
  communication!: number;

  @IsInt({ message: 'La calidad debe ser un entero' })
  @Min(1, { message: 'La calidad mínima es 1' })
  @Max(5, { message: 'La calidad máxima es 5' })
  quality!: number;

  @IsOptional()
  @IsString({ message: 'El comentario debe ser texto' })
  @MaxLength(500, { message: 'El comentario admite máximo 500 caracteres' })
  comment?: string;
}
