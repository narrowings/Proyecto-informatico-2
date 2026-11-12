import { z } from 'zod';

export const EMAIL_TAKEN_MESSAGE = 'Este correo ya está registrado. Por favor, inicia sesión.';
export const PASSWORD_HINT = 'Mínimo 8 caracteres, con mayúscula, minúscula y número.';
const PASSWORD_ERROR =
  'La contraseña no cumple la política: mínimo 8 caracteres, con mayúscula, minúscula y número.';

/** Política de seguridad de HU-001: mínimo 8 caracteres, mayúscula, minúscula y número. */
export function isStrongPassword(value: string): boolean {
  return value.length >= 8 && /\p{Lu}/u.test(value) && /\p{Ll}/u.test(value) && /\d/.test(value);
}

const mustBeChecked = (message: string) => z.boolean().refine((checked) => checked, message);

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Ingresa tu nombre.'),
  email: z
    .string()
    .trim()
    .min(1, 'Ingresa tu correo electrónico.')
    .refine((value) => z.email().safeParse(value).success, 'Ingresa un correo electrónico válido.'),
  phone: z.string().trim().min(1, 'Ingresa tu número de contacto.'),
  password: z.string().min(1, 'Ingresa una contraseña.').refine(isStrongPassword, PASSWORD_ERROR),
  termsAccepted: mustBeChecked('Debes aceptar los términos y condiciones para crear tu cuenta.'),
  privacyAccepted: mustBeChecked('Debes aceptar la política de privacidad para crear tu cuenta.'),
  dataAuthorization: mustBeChecked(
    'Debes autorizar el tratamiento de tus datos personales para crear tu cuenta.',
  ),
  isAdult: mustBeChecked(
    'La plataforma es solo para mayores de 18 años. Confirma que lo eres para crear tu cuenta.',
  ),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
