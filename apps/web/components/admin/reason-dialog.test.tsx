import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReasonDialog } from './reason-dialog';

const renderDialog = (onConfirm = vi.fn().mockResolvedValue(null), onClose = vi.fn()) => {
  render(
    <>
      <button id="trigger">Abrir</button>
      <ReasonDialog
        open
        title="Confirmar acción"
        confirmLabel="Confirmar"
        returnFocusId="trigger"
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </>,
  );
  return { onConfirm, onClose };
};

describe('Diálogo de motivo administrativo', () => {
  it.each(['', 'corto', 'x'.repeat(501)])('no envía un motivo inválido', async (reason) => {
    const { onConfirm } = renderDialog();
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: reason } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText(/motivo debe tener al menos|máximo/i)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('envía una vez aunque se haga doble clic', async () => {
    const resolve = vi.fn();
    const onConfirm = vi
      .fn()
      .mockReturnValue(new Promise<string | null>((done) => resolve.mockImplementation(done)));
    const { onClose } = renderDialog(onConfirm);
    fireEvent.change(screen.getByLabelText('Motivo'), {
      target: { value: 'Motivo válido para moderar' },
    });
    const submit = screen.getByRole('button', { name: 'Confirmar' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    resolve(null);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('Esc cierra y devuelve el foco al botón que abrió el diálogo', async () => {
    const { onClose } = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    await waitFor(() => expect(document.getElementById('trigger')).toHaveFocus());
  });
});
