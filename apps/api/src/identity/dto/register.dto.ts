import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

// RF-01-02: mínimo 8 caracteres, con mayúscula, minúscula y número.
export const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

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

  // HU-017 CA1: cuatro casillas separadas y no premarcadas (RF-01-06).
  @Equals(true, { message: 'Debes aceptar los términos y condiciones' })
  acceptTerms!: boolean;

  @Equals(true, { message: 'Debes aceptar la política de privacidad' })
  acceptPrivacyPolicy!: boolean;

  @Equals(true, { message: 'Debes autorizar el tratamiento de tus datos personales' })
  authorizeDataTreatment!: boolean;

  // HU-017 CA3
  @Equals(true, { message: 'La plataforma es solo para mayores de 18 años' })
  confirmAdult!: boolean;
}
