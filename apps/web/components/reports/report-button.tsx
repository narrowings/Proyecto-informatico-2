'use client';

import { useEffect, useRef, useState } from 'react';
import {
  reportsApi,
  type ReportProfileKind,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const reasons: { value: ReportReason; label: string }[] = [
  { value: 'FRAUD', label: 'Fraude o estafa' },
  { value: 'INAPPROPRIATE', label: 'Contenido inapropiado' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'OTHER', label: 'Otro' },
];

export function ReportButton({
  targetType,
  targetId,
  profileKind,
  onReported,
}: {
  targetType: ReportTargetType;
  targetId: string;
  profileKind?: ReportProfileKind;
  onReported?: () => void;
}) {
  const buttonId = `report-${targetId}`;
  const dialog = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('FRAUD');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const done = message?.tone === 'success';
  const [sending, setSending] = useState(false);
  const close = () => {
    setOpen(false);
    setMessage(undefined);
    window.setTimeout(() => document.getElementById(buttonId)?.focus(), 0);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const focusable = dialog.current?.querySelectorAll<HTMLElement>('button,select,textarea');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    dialog.current?.querySelector<HTMLElement>('select')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  async function submit() {
    if (reason === 'OTHER' && description.trim().length < 10) {
      setMessage({ tone: 'danger', text: 'Describe el reporte con al menos 10 caracteres.' });
      return;
    }
    if (sending) return;
    setSending(true);
    setMessage(undefined);
    const failure = 'No pudimos enviar el reporte. Inténtalo de nuevo.';
    try {
      const result = await reportsApi.create({
        targetType,
        targetId,
        profileKind,
        reason,
        ...(description.trim() && { description: description.trim() }),
      });
      if (result.status === 'reported') {
        setMessage({ tone: 'success', text: result.message });
        onReported?.();
        return;
      }
      const texts = {
        already_reported: 'Ya reportaste este elemento.',
        cannot_report_self: 'No puedes reportarte a ti mismo.',
        not_found: 'Este elemento ya no está disponible.',
        rate_limited: 'Enviaste demasiados reportes. Espera un momento y vuelve a intentarlo.',
        invalid:
          result.status === 'invalid' ? (result.errors.description?.[0] ?? failure) : failure,
      };
      setMessage({ tone: 'danger', text: texts[result.status] });
    } catch {
      setMessage({ tone: 'danger', text: failure });
    } finally {
      setSending(false);
    }
  }
  return (
    <>
      <Button id={buttonId} variant="secondary" onClick={() => setOpen(true)}>
        Reportar
      </Button>
      {open ? (
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
            aria-labelledby="report-title"
            className="w-full max-w-md rounded-card bg-white p-5 shadow-xl"
          >
            <h2 id="report-title" className="font-display text-2xl font-bold">
              Reportar
            </h2>
            <p className="mt-2 text-sm text-muted">
              Tu reporte será revisado por el equipo de moderación.
            </p>
            <div className="mt-4 flex flex-col gap-4">
              {done ? null : (
                <>
                  <Select
                    label="Motivo"
                    value={reason}
                    onChange={(event) => setReason(event.target.value as ReportReason)}
                  >
                    {reasons.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                  {reason === 'OTHER' ? (
                    <Textarea
                      label="Descripción"
                      value={description}
                      maxLength={1000}
                      onChange={(event) => setDescription(event.target.value)}
                      hint={`${description.length}/1000 caracteres`}
                    />
                  ) : null}
                </>
              )}
              <div aria-live="polite">
                {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={close}>
                  {done ? 'Cerrar' : 'Cancelar'}
                </Button>
                {done ? null : (
                  <Button aria-disabled={sending} onClick={submit}>
                    {sending ? 'Enviando…' : 'Enviar reporte'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
