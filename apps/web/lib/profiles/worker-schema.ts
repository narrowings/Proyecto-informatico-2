import { z } from 'zod';

/** RNF-REN-07: imágenes de hasta 5 MB. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const MAX_SKILLS = 15;
export const MAX_SKILL_LENGTH = 40;
/** Límites del modelo `WorkerProfile` (T-01). */
export const MAX_NAME_LENGTH = 120;
export const MAX_EXPERIENCE_LENGTH = 2000;

const normalize = (skill: string) => skill.trim().replace(/\s+/g, ' ');

/** Agrega una habilidad sin espacios sobrantes ni duplicados (sin distinguir mayúsculas). */
export function addSkill(skills: string[], raw: string): string[] {
  const skill = normalize(raw);
  if (!skill) return skills;
  const exists = skills.some((s) => s.toLocaleLowerCase('es') === skill.toLocaleLowerCase('es'));
  return exists ? skills : [...skills, skill];
}

/** Agrega varias habilidades sin pasar del máximo permitido. */
export function addSkills(skills: string[], raws: string[]): string[] {
  return raws.reduce((acc, raw) => (acc.length >= MAX_SKILLS ? acc : addSkill(acc, raw)), skills);
}

export const photoSchema = z
  .custom<File | null>((value) => value === null || value instanceof File)
  .refine((file): file is File => file instanceof File, 'Agrega una foto de perfil.')
  .refine(
    (file) => !(file instanceof File) || (PHOTO_TYPES as readonly string[]).includes(file.type),
    'La foto debe ser JPG, PNG o WebP.',
  )
  .refine(
    (file) => !(file instanceof File) || file.size <= MAX_PHOTO_BYTES,
    'La foto no puede pesar más de 5 MB.',
  );

/**
 * Perfil de trabajador (HU-002). CA2 exige al menos una habilidad, una
 * categoría de interés y la zona. La foto también es obligatoria porque el
 * modelo de datos la exige (`WorkerProfile.photoUrl`).
 */
export const workerProfileSchema = z.object({
  photo: photoSchema,
  displayName: z
    .string()
    .trim()
    .min(1, 'Ingresa tu nombre.')
    .max(MAX_NAME_LENGTH, `El nombre admite máximo ${MAX_NAME_LENGTH} caracteres.`),
  skills: z
    .array(z.string().max(MAX_SKILL_LENGTH))
    .min(1, 'Agrega al menos una habilidad.')
    .max(MAX_SKILLS, `Puedes agregar máximo ${MAX_SKILLS} habilidades.`),
  experience: z
    .string()
    .trim()
    .max(
      MAX_EXPERIENCE_LENGTH,
      `La experiencia admite máximo ${MAX_EXPERIENCE_LENGTH} caracteres.`,
    ),
  categoryIds: z.array(z.number().int()).min(1, 'Elige al menos una categoría de interés.'),
  zoneId: z.string().min(1, 'Elige tu zona de Cali.'),
});

export type WorkerProfileFormValues = z.input<typeof workerProfileSchema>;
export type WorkerProfileFormOutput = z.output<typeof workerProfileSchema>;
