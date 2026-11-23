import type { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAIL_FROM, MailService } from './mail.service';

vi.mock('nodemailer', () => ({ createTransport: vi.fn() }));

const sendMail = vi.fn();
const config = (env: Record<string, string>) =>
  ({ get: vi.fn((key: string) => env[key]) }) as unknown as ConfigService;
const transportOptions = () =>
  vi.mocked(createTransport).mock.calls[0][0] as Record<string, unknown>;

beforeEach(() => {
  vi.mocked(createTransport).mockReset();
  vi.mocked(createTransport).mockReturnValue({ sendMail } as never);
  sendMail.mockReset().mockResolvedValue({});
});

describe('MailService', () => {
  it('Mailpit: sin usuario no lleva auth ni exige TLS', () => {
    new MailService(config({ SMTP_HOST: 'localhost', SMTP_PORT: '1025', SMTP_SECURE: 'false' }));
    expect(transportOptions()).toMatchObject({
      host: 'localhost',
      port: 1025,
      secure: false,
      requireTLS: false,
    });
    expect(transportOptions()).not.toHaveProperty('auth');
  });

  it('puerto 465: SMTP_SECURE=true usa TLS desde el inicio y envía las credenciales', () => {
    new MailService(
      config({
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'cuenta@gmail.com',
        SMTP_PASS: 'clave-de-aplicacion',
      }),
    );
    expect(transportOptions()).toMatchObject({
      port: 465,
      secure: true,
      requireTLS: false,
      auth: { user: 'cuenta@gmail.com', pass: 'clave-de-aplicacion' },
    });
  });

  it('puerto 587 con usuario exige STARTTLS para no enviar la clave en claro', () => {
    new MailService(
      config({
        SMTP_HOST: 'smtp-relay.brevo.com',
        SMTP_PORT: '587',
        SMTP_USER: 'u',
        SMTP_PASS: 'p',
      }),
    );
    expect(transportOptions()).toMatchObject({ port: 587, secure: false, requireTLS: true });
  });

  it('pone timeouts para no dejar colgado el registro', () => {
    new MailService(config({ SMTP_HOST: 'localhost' }));
    expect(transportOptions()).toMatchObject({
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
  });

  it('envía con el remitente de MAIL_FROM o el predeterminado', async () => {
    const content = { to: 'ana@correo.com', subject: 'Asunto', text: 'texto', html: '<p>html</p>' };
    await new MailService(config({ SMTP_HOST: 'localhost' })).send(content);
    expect(sendMail).toHaveBeenLastCalledWith({ from: DEFAULT_MAIL_FROM, ...content });

    await new MailService(config({ SMTP_HOST: 'localhost', MAIL_FROM: 'Red <a@b.co>' })).send(
      content,
    );
    expect(sendMail).toHaveBeenLastCalledWith({ from: 'Red <a@b.co>', ...content });
  });

  it('propaga el error del servidor SMTP a quien llama', async () => {
    sendMail.mockRejectedValue(new Error('SMTP caído'));
    await expect(
      new MailService(config({ SMTP_HOST: 'localhost' })).send({
        to: 'a@b.co',
        subject: 's',
        text: 't',
        html: 'h',
      }),
    ).rejects.toThrow('SMTP caído');
  });
});
