import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ConfirmEmailDto {
  @IsNotEmpty({ message: 'Falta el token de confirmación' })
  @IsString()
  token!: string;
}

export class ResendConfirmationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  email!: string;
}
