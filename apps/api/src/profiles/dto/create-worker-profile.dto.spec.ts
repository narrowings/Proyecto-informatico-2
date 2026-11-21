import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validationPipe } from '../../common/validation';
import { CreateWorkerProfileDto } from './create-worker-profile.dto';

// Simula lo que llega por multipart/form-data: todos los campos son texto.
const form = (overrides: Record<string, unknown> = {}) => ({
  displayName: '  Ana Gómez ',
  skills: JSON.stringify(['Pintura', 'Plomería']),
  experience: 'Cinco años en obras',
  zoneId: '2',
  categoryIds: JSON.stringify([1, 3]),
  ...overrides,
});

const validate = (body: object) =>
  validationPipe.transform(body, { type: 'body', metatype: CreateWorkerProfileDto });

const fieldErrors = async (body: object) => {
  try {
    await validate(body);
  } catch (error) {
    return ((error as BadRequestException).getResponse() as { errors: Record<string, string[]> })
      .errors;
  }
  throw new Error('Se esperaba un error de validación');
};

describe('CreateWorkerProfileDto (HU-002 CA2)', () => {
  it('convierte los campos de texto del formulario a sus tipos', async () => {
    expect(await validate(form())).toEqual({
      displayName: 'Ana Gómez',
      skills: ['Pintura', 'Plomería'],
      experience: 'Cinco años en obras',
      zoneId: 2,
      categoryIds: [1, 3],
    });
  });

  it('limpia espacios y quita habilidades repetidas sin distinguir mayúsculas', async () => {
    const dto = await validate(
      form({ skills: JSON.stringify(['  Pintura  de  casas ', 'pintura de casas', '', 'Aseo']) }),
    );
    expect(dto.skills).toEqual(['Pintura de casas', 'Aseo']);
  });

  it('la experiencia es opcional', async () => {
    const body: Record<string, unknown> = form();
    delete body.experience;
    expect((await validate(body)).experience).toBeUndefined();
  });

  it.each([
    ['sin habilidades', { skills: '[]' }, 'skills', 'Agrega al menos una habilidad'],
    ['solo espacios', { skills: '["   "]' }, 'skills', 'Agrega al menos una habilidad'],
    ['JSON inválido', { skills: 'Pintura' }, 'skills', 'Agrega al menos una habilidad'],
    [
      'más de 15',
      { skills: JSON.stringify(Array.from({ length: 16 }, (_, i) => `h${i}`)) },
      'skills',
      'Puedes agregar máximo 15 habilidades',
    ],
    [
      'habilidad de 41 caracteres',
      { skills: JSON.stringify(['x'.repeat(41)]) },
      'skills',
      'Cada habilidad admite máximo 40 caracteres',
    ],
    [
      'sin categorías',
      { categoryIds: '[]' },
      'categoryIds',
      'Elige al menos una categoría de interés',
    ],
    ['categoría no numérica', { categoryIds: '["a"]' }, 'categoryIds', 'Elige categorías válidas'],
    ['categoría negativa', { categoryIds: '[-1]' }, 'categoryIds', 'Elige categorías válidas'],
    ['sin zona', { zoneId: '' }, 'zoneId', 'Elige tu zona de Cali'],
    ['zona decimal', { zoneId: '1.5' }, 'zoneId', 'Elige tu zona de Cali'],
    ['zona cero', { zoneId: '0' }, 'zoneId', 'Elige tu zona de Cali'],
    ['sin nombre', { displayName: '   ' }, 'displayName', 'Ingresa tu nombre'],
    [
      'nombre de 121 caracteres',
      { displayName: 'a'.repeat(121) },
      'displayName',
      'El nombre admite máximo 120 caracteres',
    ],
    [
      'experiencia de 2001 caracteres',
      { experience: 'a'.repeat(2001) },
      'experience',
      'La experiencia admite máximo 2000 caracteres',
    ],
  ])('rechaza %s', async (_case, overrides, field, message) => {
    expect((await fieldErrors(form(overrides)))[field]).toEqual([message]);
  });

  it('rechaza campos que no son del perfil (no se puede fijar la disponibilidad ni el dueño)', async () => {
    const errors = await fieldErrors(form({ availability: 'UNAVAILABLE', userId: 'otro' }));
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['availability', 'userId']));
  });
});
