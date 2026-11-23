import type { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { beforeEach, expect, it, vi } from 'vitest';
import { MailService } from '../mail/mail.service';
import { SmtpPasswordResetMailer } from './password-reset-mailer';

vi.mock('nodemailer', () => ({ createTransport: vi.fn() }));

const sendMail = vi.fn();
beforeEach(() => {
  sendMail.mockReset().mockResolvedValue({});
  vi.mocked(createTransport).mockReturnValue({ sendMail } as never);
});

it('HU-018: envía la recuperación al destinatario con el asunto y el enlace', async () => {
  const config = { get: vi.fn((key: string) => ({ SMTP_HOST: 'localhost' })[key]) };
  const mailer = new SmtpPasswordResetMailer(new MailService(config as unknown as ConfigService));
  const link = 'https://qa.test/restablecer-contrasena?token=abc123';

  await mailer.send({ to: 'ana@correo.com', name: 'Ana', link });

  expect(sendMail).toHaveBeenCalledOnce();
  const sent = sendMail.mock.calls[0][0];
  expect(sent).toMatchObject({ to: 'ana@correo.com', subject: 'Restablece tu contraseña' });
  expect(sent.text).toContain(link);
  expect(sent.html).toContain(`href="${link}"`);
});
