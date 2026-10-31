import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validationPipe } from '../../common/validation';
import { RegisterDto } from './register.dto';

const valid = {
  name: ' Ana Gómez ',
  email: ' Ana@Correo.COM ',
  phone: '+57 300 123 4567',
  password: 'Segura123',
  acceptTerms: true,
  acceptPrivacyPolicy: true,
  authorizeDataTreatment: true,
  confirmAdult: true,
};

const transform = (body: object) =>
  validationPipe.transform(body, { type: 'body', metatype: RegisterDto });

const fieldErrors = async (body: object) => {
  try {
    await transform(body);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return ((error as BadRequestException).getResponse() as { errors: Record<string, string[]> })
      .errors;
  }
  throw new Error('se esperaba un error de validación');
};

describe('RegisterDto', () => {
  it('normaliza nombre, correo y teléfono de un registro válido', async () => {
    const dto = (await transform(valid)) as RegisterDto;
    expect(dto).toMatchObject({
      name: 'Ana Gómez',
      email: 'ana@correo.com',
      phone: '+573001234567',
    });
  });

  it('HU-001 CA4: un mensaje en español junto a cada campo vacío', async () => {
    const errors = await fieldErrors({ ...valid, name: '', email: undefined, phone: '' });
    expect(errors).toEqual({
      name: ['El nombre es obligatorio'],
      email: ['El correo es obligatorio'],
      phone: ['El número de contacto es obligatorio'],
    });
  });

  it.each(['corta1A', 'sinmayuscula1', 'SINMINUSCULA1', 'SinNumeroAqui'])(
    'HU-001 CA4: rechaza la contraseña %s',
    async (password) => {
      const errors = await fieldErrors({ ...valid, password });
      expect(errors.password).toEqual([
        'La contraseña debe tener mínimo 8 caracteres, con mayúscula, minúscula y número',
      ]);
    },
  );

  it('HU-001 CA4: rechaza un correo con formato inválido', async () => {
    const errors = await fieldErrors({ ...valid, email: 'ana@' });
    expect(errors.email).toEqual(['Ingresa un correo electrónico válido']);
  });

  it('HU-017 CA1 y CA3: exige las cuatro casillas legales', async () => {
    const errors = await fieldErrors({
      ...valid,
      authorizeDataTreatment: false,
      confirmAdult: undefined,
    });
    expect(errors).toEqual({
      authorizeDataTreatment: ['Debes autorizar el tratamiento de tus datos personales'],
      confirmAdult: ['La plataforma es solo para mayores de 18 años'],
    });
  });
});
