import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escape-html';
import { confirmationEmail, notificationEmail, passwordResetEmail } from './templates';

const LINK = 'https://qa.test/confirmar-correo?token=abc&x=1';
const XSS = '<script>alert("x")</script>';

describe('escapeHtml', () => {
  it('escapa los caracteres especiales de HTML', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});

describe('Plantillas de correo', () => {
  it('confirmación: asunto, enlace y vigencia de 24 horas', () => {
    const mail = confirmationEmail({ name: 'Ana', link: LINK });
    expect(mail.subject).toBe('Confirma tu correo electrónico');
    expect(mail.text).toContain(LINK);
    expect(mail.text).toContain('24 horas');
    expect(mail.html).toContain(`href="${escapeHtml(LINK)}"`);
    expect(mail.html).toContain('24 horas');
  });

  it('recuperación: asunto, enlace, 30 minutos y un solo uso', () => {
    const mail = passwordResetEmail({ name: 'Ana', link: LINK });
    expect(mail.subject).toBe('Restablece tu contraseña');
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain('30 minutos');
      expect(body).toContain('una vez');
    }
    expect(mail.text).toContain(LINK);
    expect(mail.html).toContain(`href="${escapeHtml(LINK)}"`);
  });

  it('notificación: asunto = título, cuerpo = texto y botón "Ver en la plataforma"', () => {
    const mail = notificationEmail({
      name: 'Ana',
      subject: 'Te seleccionaron',
      text: 'El publicador te eligió para el trabajo.',
      link: 'https://qa.test/mi-actividad',
    });
    expect(mail.subject).toBe('Te seleccionaron');
    expect(mail.text).toContain('El publicador te eligió para el trabajo.');
    expect(mail.text).toContain('https://qa.test/mi-actividad');
    expect(mail.html).toContain('Ver en la plataforma');
    expect(mail.html).toContain('href="https://qa.test/mi-actividad"');
  });

  it('escapa en el HTML un nombre como <script>', () => {
    for (const mail of [
      confirmationEmail({ name: XSS, link: LINK }),
      passwordResetEmail({ name: XSS, link: LINK }),
      notificationEmail({ name: XSS, subject: 's', text: 't', link: LINK }),
    ]) {
      expect(mail.html).not.toContain('<script>');
      expect(mail.html).toContain('&lt;script&gt;');
    }
  });

  it('escapa en el HTML el título y el texto de la notificación', () => {
    const mail = notificationEmail({
      name: 'Ana',
      subject: XSS,
      text: `<img src=x onerror=1>`,
      link: LINK,
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('<img');
    expect(mail.html).toContain('&lt;img src=x onerror=1&gt;');
  });

  it('un enlace con comillas no rompe el atributo href', () => {
    const mail = confirmationEmail({ name: 'Ana', link: 'https://x.co/"><script>' });
    expect(mail.html).not.toContain('"><script>');
  });
});
