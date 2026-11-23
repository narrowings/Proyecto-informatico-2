import type { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { beforeEach, expect, it, vi } from 'vitest';
import { MailService } from '../mail/mail.service';
import { SmtpNotificationMailer } from './notification-mailer';

vi.mock('nodemailer', () => ({ createTransport: vi.fn() }));

const sendMail = vi.fn();
beforeEach(() => {
  sendMail.mockReset().mockResolvedValue({});
  vi.mocked(createTransport).mockReturnValue({ sendMail } as never);
});

it('envía el aviso con el título como asunto, el texto y el enlace', async () => {
  const config = { get: vi.fn((key: string) => ({ SMTP_HOST: 'localhost' })[key]) };
  const mailer = new SmtpNotificationMailer(new MailService(config as unknown as ConfigService));
  const link = 'https://qa.test/mi-actividad';

  await mailer.send({
    to: 'ana@correo.com',
    name: 'Ana',
    subject: 'Te seleccionaron',
    text: 'El publicador te eligió para el trabajo.',
    link,
  });

  expect(sendMail).toHaveBeenCalledOnce();
  const sent = sendMail.mock.calls[0][0];
  expect(sent).toMatchObject({ to: 'ana@correo.com', subject: 'Te seleccionaron' });
  expect(sent.text).toContain('El publicador te eligió para el trabajo.');
  expect(sent.text).toContain(link);
  expect(sent.html).toContain(`href="${link}"`);
  expect(sent.html).toContain('Ver en la plataforma');
});
