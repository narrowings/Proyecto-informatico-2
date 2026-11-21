import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export const MAX_SKILLS = 15;
export const MAX_SKILL_LENGTH = 40;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// El formulario llega como multipart/form-data (con la foto), así que las listas viajan como texto
// JSON. Si no es JSON válido se deja el texto tal cual y la validación de arreglo lo rechaza.
const parseJson = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

// Habilidades sin espacios sobrantes ni duplicadas (sin distinguir mayúsculas), como en el frontend.
const normalizeSkills = ({ value }: { value: unknown }) => {
  const parsed = parseJson({ value });
  if (!Array.isArray(parsed)) return parsed;
  const seen = new Set<string>();
  const skills: unknown[] = [];
  for (const item of parsed) {
    if (typeof item !== 'string') {
      skills.push(item);
      continue;
    }
    const skill = item.trim().replace(/\s+/g, ' ');
    const key = skill.toLocaleLowerCase('es');
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    skills.push(skill);
  }
  return skills;
};

const toInt = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;

// HU-002 CA1 y CA2: nombre, foto, habilidades, experiencia opcional, zona de Cali y categorías.
// Como en RegisterDto, IsNotEmpty/ArrayMinSize van al final para que sean la primera validación.
export class CreateWorkerProfileDto {
  @Transform(trim)
  @MaxLength(120, { message: 'El nombre admite máximo 120 caracteres' })
  @IsString()
  @IsNotEmpty({ message: 'Ingresa tu nombre' })
  displayName!: string;

  @Transform(normalizeSkills)
  @MaxLength(MAX_SKILL_LENGTH, {
    each: true,
    message: `Cada habilidad admite máximo ${MAX_SKILL_LENGTH} caracteres`,
  })
  @IsString({ each: true, message: 'Las habilidades deben ser texto' })
  @ArrayMaxSize(MAX_SKILLS, { message: `Puedes agregar máximo ${MAX_SKILLS} habilidades` })
  @ArrayMinSize(1, { message: 'Agrega al menos una habilidad' })
  @IsArray({ message: 'Agrega al menos una habilidad' })
  skills!: string[];

  @IsOptional()
  @Transform(trim)
  @MaxLength(2000, { message: 'La experiencia admite máximo 2000 caracteres' })
  @IsString()
  experience?: string;

  @Transform(toInt)
  @IsPositive({ message: 'Elige tu zona de Cali' })
  @IsInt({ message: 'Elige tu zona de Cali' })
  zoneId!: number;

  @Transform(parseJson)
  @IsPositive({ each: true, message: 'Elige categorías válidas' })
  @IsInt({ each: true, message: 'Elige categorías válidas' })
  @ArrayMaxSize(20, { message: 'Puedes elegir máximo 20 categorías' })
  @ArrayMinSize(1, { message: 'Elige al menos una categoría de interés' })
  @IsArray({ message: 'Elige al menos una categoría de interés' })
  categoryIds!: number[];
}
