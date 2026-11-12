import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { Alert, Button, ButtonLink, Checkbox, Field, Select, Textarea } from './index';

afterEach(cleanup);

describe('Controles compartidos de T-02', () => {
  it('asocia etiquetas y errores conservando las descripciones externas', () => {
    render(
      <>
        <p id="privacy">Tu información es privada.</p>
        <Field
          id="name"
          label="Nombre"
          hint="Nombre completo"
          error="Es obligatorio"
          aria-describedby="privacy"
        />
        <Select label="Sector" error="Selecciona un sector">
          <option value="">Seleccionar</option>
        </Select>
        <Textarea label="Descripción" hint="Describe tu actividad" />
        <Checkbox label="Acepto los términos" error="Debes aceptar" aria-describedby="privacy" />
      </>,
    );
    expect(screen.getByLabelText('Nombre').getAttribute('aria-describedby')).toBe(
      'privacy name-hint name-error',
    );
    for (const label of ['Nombre', 'Sector', 'Acepto los términos']) {
      const control = screen.getByLabelText(label);
      expect(control.getAttribute('aria-invalid')).toBe('true');
      for (const id of control.getAttribute('aria-describedby')!.split(' ')) {
        expect(document.getElementById(id)?.textContent).toBeTruthy();
      }
    }
  });

  it('permite registro por ref y envía los valores nativos del formulario', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    const submit = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(Object.fromEntries(new FormData(event.currentTarget)));
        }}
      >
        <Field ref={ref} label="Nombre" name="name" required />
        <Select label="Sector" name="sector">
          <option value="services">Servicios</option>
        </Select>
        <Textarea label="Descripción" name="description" />
        <Checkbox label="Acepto" name="terms" />
        <Button type="submit">Guardar</Button>
      </form>,
    );
    expect(ref.current).toBe(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Diego');
    await user.type(screen.getByLabelText('Descripción'), 'Servicios en Cali');
    await user.click(screen.getByLabelText('Acepto'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(submit).toHaveBeenCalledWith({
      name: 'Diego',
      sector: 'services',
      description: 'Servicios en Cali',
      terms: 'on',
    });
  });

  it('impide activar botones deshabilitados con teclado o ratón', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button aria-disabled="true" onClick={onClick}>
          Crear cuenta
        </Button>
        <Button disabled onClick={onClick}>
          Guardar
        </Button>
      </>,
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Crear cuenta' }));
    await user.keyboard('{Enter} ');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('impide la navegación de un enlace marcado como deshabilitado', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ButtonLink href="/registro" aria-disabled onClick={onClick}>
        Continuar
      </ButtonLink>,
    );
    let prevented = false;
    const observe = (event: MouseEvent) => {
      prevented = event.defaultPrevented;
    };
    document.addEventListener('click', observe);
    await user.click(screen.getByRole('link', { name: 'Continuar' }));
    document.removeEventListener('click', observe);
    expect(prevented).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('cumple las reglas estructurales de accesibilidad de axe', async () => {
    const { container } = render(
      <main>
        <h1>Perfil de publicador</h1>
        <Field label="Nombre" required error="Completa tu nombre" />
        <Select label="Sector">
          <option>Servicios</option>
        </Select>
        <Textarea label="Descripción" />
        <Checkbox label="Acepto los términos" />
        <Alert tone="danger" role="alert">
          Revisa los campos indicados.
        </Alert>
        <Button>Guardar</Button>
        <ButtonLink href="/">Volver</ButtonLink>
      </main>,
    );
    // El contraste requiere un navegador con layout; se revisa por separado.
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
