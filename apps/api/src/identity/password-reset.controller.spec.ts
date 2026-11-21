import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rateLimitOptions } from '../common/http/rate-limit';
import { validationPipe } from '../common/validation';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';

describe('HU-018 Recuperación de contraseña por HTTP', () => {
  let app: INestApplication;
  let url: string;
  const servicio = { programarEnvio: vi.fn(), restablecer: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    @Module({
      imports: [ThrottlerModule.forRoot(rateLimitOptions)],
      controllers: [PasswordResetController],
      providers: [{ provide: PasswordResetService, useValue: servicio }],
    })
    class ModuloPrueba {}
    app = await NestFactory.create(ModuloPrueba, { logger: false, abortOnError: false });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(validationPipe);
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/v1/auth`;
  });

  afterEach(() => app?.close());

  const enviar = (ruta: string, body: object) =>
    fetch(`${url}/${ruta}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('responde el mismo 202 para los correos existente e inexistente y aplica el límite por IP', async () => {
    const mensaje = { message: 'Si el correo está registrado, recibirás un enlace' };
    for (const email of ['ana@example.com', 'nadie@example.com', 'otra@example.com']) {
      const respuesta = await enviar('forgot-password', { email });
      expect(respuesta.status).toBe(202);
      expect(await respuesta.json()).toEqual(mensaje);
    }
    expect((await enviar('forgot-password', { email: 'cuarto@example.com' })).status).toBe(429);
    expect(servicio.programarEnvio).toHaveBeenCalledTimes(3);
  });

  it('rechaza el correo mal formado con un error por campo', async () => {
    const respuesta = await enviar('forgot-password', { email: 'ana' });
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ errors: { email: expect.any(Array) } });
  });

  it('rechaza la contraseña débil sin ejecutar el restablecimiento', async () => {
    const respuesta = await enviar('reset-password', {
      token: 'token-de-prueba',
      password: 'debil',
      passwordConfirmation: 'debil',
    });
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ errors: { password: expect.any(Array) } });
    expect(servicio.restablecer).not.toHaveBeenCalled();
  });
});
