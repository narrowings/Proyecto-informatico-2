import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PaginacionDto {
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un entero' })
  @Min(1, { message: 'La página mínima es 1' })
  @Max(1_000_000, { message: 'La página máxima es 1000000' })
  page = 1;

  @Type(() => Number)
  @IsInt({ message: 'El tamaño de página debe ser un entero' })
  @Min(1, { message: 'El tamaño mínimo de página es 1' })
  @Max(50, { message: 'El tamaño máximo de página es 50' })
  pageSize = 20;
}
