import { describe, expect, it } from 'vitest';
import {
  addSkill,
  addSkills,
  MAX_PHOTO_BYTES,
  MAX_SKILLS,
  workerProfileSchema,
} from './worker-schema';

const photo = (type = 'image/png', size = 1024) =>
  new File([new Uint8Array(size)], 'foto.png', { type });

const valid = {
  photo: photo(),
  displayName: 'Ana Pérez',
  skills: ['Logística'],
  experience: '',
  categoryIds: [1],
  zoneId: '2',
};

const messages = (values: unknown) => {
  const result = workerProfileSchema.safeParse(values);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
};

describe('workerProfileSchema', () => {
  it('acepta un perfil completo con experiencia vacía (opcional)', () => {
    expect(workerProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('exige habilidad, categoría y zona (HU-002 CA2)', () => {
    expect(messages({ ...valid, skills: [], categoryIds: [], zoneId: '' })).toEqual({
      skills: 'Agrega al menos una habilidad.',
      categoryIds: 'Elige al menos una categoría de interés.',
      zoneId: 'Elige tu zona de Cali.',
    });
  });

  it('exige la foto y el nombre', () => {
    expect(messages({ ...valid, photo: null, displayName: '   ' })).toEqual({
      photo: 'Agrega una foto de perfil.',
      displayName: 'Ingresa tu nombre.',
    });
  });

  it('rechaza fotos que no son imagen o que pesan más de 5 MB', () => {
    expect(messages({ ...valid, photo: photo('application/pdf') }).photo).toBe(
      'La foto debe ser JPG, PNG o WebP.',
    );
    expect(messages({ ...valid, photo: photo('image/jpeg', MAX_PHOTO_BYTES + 1) }).photo).toBe(
      'La foto no puede pesar más de 5 MB.',
    );
  });

  it(`limita a ${MAX_SKILLS} habilidades`, () => {
    const skills = Array.from({ length: MAX_SKILLS + 1 }, (_, i) => `Habilidad ${i}`);
    expect(messages({ ...valid, skills }).skills).toMatch(/máximo/);
  });
});

describe('addSkill', () => {
  it('quita espacios sobrantes', () => {
    expect(addSkill([], '  Edición   de video ')).toEqual(['Edición de video']);
  });

  it('ignora vacíos y duplicados sin distinguir mayúsculas', () => {
    expect(addSkill(['Logística'], '   ')).toEqual(['Logística']);
    expect(addSkill(['Logística'], 'LOGÍSTICA')).toEqual(['Logística']);
  });
});

describe('addSkills', () => {
  it('agrega varias y no pasa del máximo', () => {
    const many = Array.from({ length: MAX_SKILLS + 3 }, (_, i) => `H${i}`);
    expect(addSkills([], ['Pintura', ' ', 'pintura', 'Plomería'])).toEqual(['Pintura', 'Plomería']);
    expect(addSkills([], many)).toHaveLength(MAX_SKILLS);
  });
});
