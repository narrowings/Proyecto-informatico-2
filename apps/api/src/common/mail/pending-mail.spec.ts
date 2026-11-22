import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmationMailerProvider,
  LoggerConfirmationMailer,
  RedactedConfirmationMailer,
  SmtpConfirmationMailer,
} from '../../identity/confirmation-mailer';
import {
  LoggerPasswordResetMailer,
  passwordResetMailerProvider,
  RedactedPasswordResetMailer,
  SmtpPasswordResetMailer,
} from '../../identity/password-reset-mailer';
import type { MailService } from '../../mail/mail.service';
import {
  LoggerNotificationMailer,
  notificationMailerProvider,
  RedactedNotificationMailer,
  SmtpNotificationMailer,
} from '../../notifications/notification-mailer';
import { mailErrorCode, maskEmail } from './pending-mail';

const config = (env: Record<string, string | undefined>) =>
  ({ get: vi.fn((key: string) => env[key]) }) as unknown as ConfigService;
const build = (provider: unknown, env: Record<string, string | undefined>) =>
  (provider as { useFactory: (c: ConfigService, m: MailService) => unknown }).useFactory(
    config(env),
    {} as MailService,
  );

const providers = [
  {
    provider: confirmationMailerProvider,
    smtp: SmtpConfirmationMailer,
    logger: LoggerConfirmationMailer,
    redacted: RedactedConfirmationMailer,
  },
  {
    provider: passwordResetMailerProvider,
    smtp: SmtpPasswordResetMailer,
    logger: LoggerPasswordResetMailer,
    redacted: RedactedPasswordResetMailer,
  },
  {
    provider: notificationMailerProvider,
    smtp: SmtpNotificationMailer,
    logger: LoggerNotificationMailer,
    redacted: RedactedNotificationMailer,
  },
];

const TOKEN = 'tok3n-secreto-de-prueba-0123456789abcdef';
const mail = { to: 'ana.gomez@correo.com', name: 'Ana', link: `https://qa.test/x?token=${TOKEN}` };

afterEach(() => vi.restoreAllMocks());

describe('Selección del correo según SMTP_HOST y NODE_ENV', () => {
  it('con SMTP_HOST se envía por SMTP en cualquier entorno', () => {
    for (const { provider, smtp } of providers) {
      for (const NODE_ENV of ['development', 'production', undefined]) {
        expect(build(provider, { SMTP_HOST: 'localhost', NODE_ENV })).toBeInstanceOf(smtp);
      }
    }
  });

  it('sin SMTP_HOST solo en desarrollo se usa el correo que escribe el enlace en el log', () => {
    for (const { provider, logger, redacted } of providers) {
      expect(build(provider, { NODE_ENV: 'development' })).toBeInstanceOf(logger);
      expect(build(provider, { NODE_ENV: 'development', SMTP_HOST: '  ' })).toBeInstanceOf(logger);
      for (const NODE_ENV of ['production', 'qa', 'test', undefined]) {
        expect(build(provider, { NODE_ENV })).toBeInstanceOf(redacted);
      }
    }
  });

  it('fuera de desarrollo el log no lleva el enlace, el token, el texto ni el correo completo', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await new RedactedConfirmationMailer().send(mail);
    await new RedactedPasswordResetMailer().send(mail);
    await new RedactedNotificationMailer().send({
      ...mail,
      subject: 'Te seleccionaron',
      text: 'Texto privado del aviso',
    });
    const written = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(warn).toHaveBeenCalledTimes(3);
    expect(written).not.toContain(TOKEN);
    expect(written).not.toContain('https://');
    expect(written).not.toContain('ana.gomez@correo.com');
    expect(written).not.toContain('Texto privado');
    expect(written).toContain('a***@correo.com');
  });

  it('enmascara el correo', () => {
    expect(maskEmail('ana.gomez@correo.com')).toBe('a***@correo.com');
    expect(maskEmail('x@y.co')).toBe('x***@y.co');
    expect(maskEmail('sin-arroba')).toBe('***');
    expect(maskEmail('@dominio.com')).toBe('***');
  });

  it('de un error de SMTP solo conserva el código', () => {
    expect(
      mailErrorCode(Object.assign(new Error('550 <ana@correo.com>'), { code: 'EENVELOPE' })),
    ).toBe('EENVELOPE');
    expect(mailErrorCode(new Error('sin código'))).toBe('DESCONOCIDO');
    expect(mailErrorCode({ code: 'ana@correo.com' })).toBe('DESCONOCIDO');
    expect(mailErrorCode(null)).toBe('DESCONOCIDO');
  });
});
