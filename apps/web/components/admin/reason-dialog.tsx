'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function ReasonDialog({
  open,
  title,
  confirmLabel,
  returnFocusId,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  returnFocusId: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<string | null>;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string>();
  const [sending, setSending] = useState(false);
  const close = () => {
    if (sending) return;
    setReason('');
    setMessage(undefined);
    onClose();
    window.setTimeout(() => document.getElementById(returnFocusId)?.focus(), 0);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab') return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button,textarea');
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    dialog.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  async function confirm() {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setMessage('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    if (sending) return;
    setSending(true);
    setMessage(undefined);
    try {
      const error = await onConfirm(trimmed);
      if (error) setMessage(error);
      else close();
    } finally {
      setSending(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40 p-4 sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-title"
        className="w-full max-w-md rounded-card bg-white p-5 shadow-xl"
      >
        <h2 id="reason-title" className="font-display text-2xl font-bold">
          {title}
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <Textarea
            label="Motivo"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            hint={`${reason.length}/500 caracteres`}
            error={message}
          />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button aria-disabled={sending} onClick={() => void confirm()}>
              {sending ? 'Guardando…' : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
