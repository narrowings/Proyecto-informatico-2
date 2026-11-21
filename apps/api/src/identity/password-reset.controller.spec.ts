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
  const service = { scheduleResetEmail: vi.fn(), resetPassword: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    @Module({
      imports: [ThrottlerModule.forRoot(rateLimitOptions)],
      controllers: [PasswordResetController],
      providers: [{ provide: PasswordResetService, useValue: service }],
    })
    class TestModule {}
    app = await NestFactory.create(TestModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(validationPipe);
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/v1/auth`;
  });

  afterEach(() => app?.close());

  const send = (route: string, body: object) =>
    fetch(`${url}/${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('responde el mismo 202 para los correos existente e inexistente y aplica el límite por IP', async () => {
    const message = { message: 'Si el correo está registrado, recibirás un enlace' };
    for (const email of ['ana@example.com', 'nadie@example.com', 'otra@example.com']) {
      const response = await send('forgot-password', { email });
      expect(response.status).toBe(202);
      expect(await response.json()).toEqual(message);
    }
    expect((await send('forgot-password', { email: 'cuarto@example.com' })).status).toBe(429);
    expect(service.scheduleResetEmail).toHaveBeenCalledTimes(3);
  });

  it('rechaza el correo mal formado con un error por campo', async () => {
    const response = await send('forgot-password', { email: 'ana' });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errors: { email: expect.any(Array) } });
  });

  it('rechaza la contraseña débil sin ejecutar el restablecimiento', async () => {
    const response = await send('reset-password', {
      token: 'token-de-prueba',
      password: 'debil',
      passwordConfirmation: 'debil',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errors: { password: expect.any(Array) } });
    expect(service.resetPassword).not.toHaveBeenCalled();
  });
});
