import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// RF-01-02: mínimo 8 caracteres, con mayúscula, minúscula y número.
export const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// HU-017 CA1 y CA2: versión de cada documento legal que el usuario vio y aceptó (cuatro casillas
// separadas y no premarcadas, RF-01-06). Si no coincide con la vigente, el registro responde 409.
// Mismo formato que envía el frontend (apps/web/lib/api/auth.ts).
export class ConsentsDto {
  @MaxLength(20, { message: 'Debes aceptar los términos y condiciones' })
  @IsString({ message: 'Debes aceptar los términos y condiciones' })
  @IsNotEmpty({ message: 'Debes aceptar los términos y condiciones' })
  terms!: string;

  @MaxLength(20, { message: 'Debes aceptar la política de privacidad' })
  @IsString({ message: 'Debes aceptar la política de privacidad' })
  @IsNotEmpty({ message: 'Debes aceptar la política de privacidad' })
  privacy!: string;

  @MaxLength(20, { message: 'Debes autorizar el tratamiento de tus datos personales' })
  @IsString({ message: 'Debes autorizar el tratamiento de tus datos personales' })
  @IsNotEmpty({ message: 'Debes autorizar el tratamiento de tus datos personales' })
  dataProcessing!: string;

  // HU-017 CA3
  @Equals(true, { message: 'La plataforma es solo para mayores de 18 años' })
  isAdult!: boolean;
}

// class-validator ejecuta primero el decorador más cercano a la propiedad y el pipe se detiene en el
// primer error de cada campo, por eso IsNotEmpty va al final.
export class RegisterDto {
  @Transform(trim)
  @MaxLength(120, { message: 'El nombre admite máximo 120 caracteres' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @MaxLength(254, { message: 'El correo admite máximo 254 caracteres' })
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email!: string;

  // Celular o fijo colombiano de 10 dígitos, con o sin +57; el servicio guarda solo los 10 dígitos.
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value))
  @Matches(/^(\+57)?\d{10}$/, { message: 'Ingresa un número de contacto de 10 dígitos' })
  @IsNotEmpty({ message: 'El número de contacto es obligatorio' })
  phone!: string;

  @Matches(PASSWORD_POLICY, {
    message: 'La contraseña debe tener mínimo 8 caracteres, con mayúscula, minúscula y número',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password!: string;

  @ValidateNested()
  @Type(() => ConsentsDto)
  @IsObject({ message: 'Debes aceptar los documentos legales para crear tu cuenta' })
  consents!: ConsentsDto;
}
