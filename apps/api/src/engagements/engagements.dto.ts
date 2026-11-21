import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsIn,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PaginacionDto } from '../common/http/paginacion.dto';

export class SeleccionarDto {
  @IsArray({ message: 'Envía una lista de postulaciones' })
  @ArrayMinSize(1, { message: 'Selecciona al menos una postulación' })
  @ArrayMaxSize(50, { message: 'Puedes seleccionar máximo 50 postulaciones' })
  @ArrayUnique({ message: 'Las postulaciones no pueden repetirse' })
  @IsUUID('all', { each: true, message: 'Cada postulación debe tener un identificador válido' })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((id: unknown) => (typeof id === 'string' ? id.toLowerCase() : id))
      : value,
  )
  applicationIds!: string[];
}

export class AceptarSeleccionDto {
  @Equals(true, { message: 'Debes aceptar los términos del trabajo' })
  acceptTerms!: true;
}

export class ListarTrabajosDto extends PaginacionDto {
  @IsIn(['worker', 'publisher'], { message: 'El rol debe ser trabajador o publicador' })
  role!: 'worker' | 'publisher';

  @IsIn(['active', 'finished'], { message: 'El estado debe ser activo o finalizado' })
  state!: 'active' | 'finished';
}

export class CancelarTrabajoDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El motivo debe ser texto' })
  @Length(5, 500, { message: 'El motivo debe tener entre 5 y 500 caracteres' })
  reason!: string;
}
