import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { PASSWORD_POLICY } from './register.dto';

export class SolicitarRestablecimientoDto {
  @MaxLength(254, { message: 'El correo admite máximo 254 caracteres' })
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;
}

export class RestablecerContrasenaDto {
  @IsString({ message: 'El token debe ser texto' })
  @IsNotEmpty({ message: 'Falta el token de recuperación' })
  @MaxLength(256, { message: 'El token de recuperación es demasiado largo' })
  token!: string;

  @Matches(PASSWORD_POLICY, {
    message: 'La contraseña debe tener entre 8 y 128 caracteres, con mayúscula, minúscula y número',
  })
  password!: string;

  @IsString({ message: 'Confirma la contraseña' })
  @IsNotEmpty({ message: 'Confirma la contraseña' })
  passwordConfirmation!: string;
}
