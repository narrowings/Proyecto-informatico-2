import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmationMailerProvider,
  LoggerConfirmationMailer,
  RedactedConfirmationMailer,
} from '../../identity/confirmation-mailer';
import {
  LoggerPasswordResetMailer,
  passwordResetMailerProvider,
  RedactedPasswordResetMailer,
} from '../../identity/password-reset-mailer';
import { maskEmail } from './pending-mail';

const config = (nodeEnv: string | undefined) =>
  ({ get: vi.fn().mockReturnValue(nodeEnv) }) as unknown as ConfigService;
const build = (provider: unknown, nodeEnv: string | undefined) =>
  (provider as { useFactory: (c: ConfigService) => unknown }).useFactory(config(nodeEnv));

const TOKEN = 'tok3n-secreto-de-prueba-0123456789abcdef';
const mail = { to: 'ana.gomez@correo.com', name: 'Ana', link: `https://qa.test/x?token=${TOKEN}` };

afterEach(() => vi.restoreAllMocks());

describe('Correos pendientes de T-04 (auditoría: tokens en el log)', () => {
  it('solo en desarrollo se usa el correo que escribe el enlace en el log', () => {
    expect(build(confirmationMailerProvider, 'development')).toBeInstanceOf(
      LoggerConfirmationMailer,
    );
    expect(build(passwordResetMailerProvider, 'development')).toBeInstanceOf(
      LoggerPasswordResetMailer,
    );
    for (const env of ['production', 'qa', 'test', undefined]) {
      expect(build(confirmationMailerProvider, env)).toBeInstanceOf(RedactedConfirmationMailer);
      expect(build(passwordResetMailerProvider, env)).toBeInstanceOf(RedactedPasswordResetMailer);
    }
  });

  it('fuera de desarrollo el log no lleva el enlace, el token ni el correo completo', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await new RedactedConfirmationMailer().send(mail);
    await new RedactedPasswordResetMailer().send(mail);
    const written = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(written).not.toContain(TOKEN);
    expect(written).not.toContain('https://');
    expect(written).not.toContain('ana.gomez@correo.com');
    expect(written).toContain('a***@correo.com');
  });

  it('enmascara el correo', () => {
    expect(maskEmail('ana.gomez@correo.com')).toBe('a***@correo.com');
    expect(maskEmail('x@y.co')).toBe('x***@y.co');
    expect(maskEmail('sin-arroba')).toBe('***');
    expect(maskEmail('@dominio.com')).toBe('***');
  });
});
