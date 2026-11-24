'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { adminApi } from '@/lib/api';
import { adminResultMessage, type LaborWarningRule, type RuleInput } from '@/lib/api/admin';
import { AdminStates } from './admin-states';
import { useAdminData } from './use-admin-data';

const HOUR = 60;
const DAY = 24 * HOUR;
const RULE_TEXT: Record<LaborWarningRule['code'], string> = {
  FULL_DAY: 'Jornada completa',
  LONG_TERM: 'Trabajo de larga duración',
  SUBORDINATION_TERMS: 'Expresiones de subordinación',
};

/** Umbral en la unidad que ve el administrador: horas, días o lista de expresiones. */
export const toDisplay = (rule: LaborWarningRule) => {
  const minutes = Number(rule.params.minMinutes);
  if (rule.code === 'FULL_DAY') return String(Math.round(minutes / HOUR));
  if (rule.code === 'LONG_TERM') return String(Math.round(minutes / DAY));
  const terms = rule.params.terms;
  return Array.isArray(terms) ? terms.join('\n') : '';
};

/** Convierte lo escrito a `params` de la API, o devuelve el error a mostrar. */
export const toParams = (
  code: LaborWarningRule['code'],
  value: string,
): { params: Record<string, unknown> } | { error: string } => {
  if (code === 'SUBORDINATION_TERMS') {
    const terms = value
      .split('\n')
      .map((term) => term.trim())
      .filter(Boolean);
    if (terms.length < 1 || terms.length > 50 || terms.some((t) => t.length < 2 || t.length > 60))
      return { error: 'Escribe de 1 a 50 expresiones, una por línea, de 2 a 60 caracteres.' };
    return { params: { terms } };
  }
  const [min, max, unit, size] =
    code === 'FULL_DAY' ? [1, 24, 'horas', HOUR] : [1, 365, 'días', DAY];
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max)
    return { error: `Escribe un número entero de ${min} a ${max} ${unit}.` };
  return { params: { minMinutes: number * size } };
};

/** RF-03-05: reglas de advertencia laboral administrables. */
export function RulesPanel() {
  const { state, reload } = useAdminData(() => adminApi.rules(), []);
  const [notice, setNotice] = useState<string>();
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-bold">Reglas laborales</h2>
      <p className="text-sm text-muted">
        Ajusta cuándo se muestra la advertencia laboral al publicar. El texto debe estar aprobado
        por asesoría jurídica.
      </p>
      <div aria-live="polite">{notice ? <Alert tone="success">{notice}</Alert> : null}</div>
      <AdminStates
        state={state}
        reload={reload}
        isEmpty={(data) => data.length === 0}
        empty="No hay reglas configuradas."
      >
        {(rules) => (
          <ul className="flex flex-col gap-3">
            {rules.map((rule) => (
              <RuleForm
                key={rule.code}
                rule={rule}
                onSaved={() => {
                  setNotice(`Regla "${RULE_TEXT[rule.code]}" guardada.`);
                  reload();
                }}
              />
            ))}
          </ul>
        )}
      </AdminStates>
    </section>
  );
}

function RuleForm({ rule, onSaved }: { rule: LaborWarningRule; onSaved: () => void }) {
  const [message, setMessage] = useState(rule.message);
  const [active, setActive] = useState(rule.isActive);
  const [value, setValue] = useState(toDisplay(rule));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const isList = rule.code === 'SUBORDINATION_TERMS';
  async function save() {
    const parsed = toParams(rule.code, value);
    if ('error' in parsed) return setError(parsed.error);
    if (message.trim().length < 20) return setError('El texto debe tener al menos 20 caracteres.');
    if (sending) return;
    setSending(true);
    const input: RuleInput = { message: message.trim(), isActive: active, params: parsed.params };
    const result = await adminApi.updateRule(rule.code, input).catch(() => null);
    setSending(false);
    const failure = result ? adminResultMessage(result) : 'No pudimos guardar. Inténtalo de nuevo.';
    setError(failure);
    if (!failure) onSaved();
  }
  return (
    <li className="flex flex-col gap-3 rounded-card border border-line p-4">
      <h3 className="text-lg font-bold">{RULE_TEXT[rule.code]}</h3>
      <Checkbox
        label="Regla activa"
        checked={active}
        onChange={(event) => setActive(event.target.checked)}
      />
      {isList ? (
        <Textarea
          label="Expresiones (una por línea)"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      ) : (
        <Field
          label={rule.code === 'FULL_DAY' ? 'Desde cuántas horas' : 'Desde cuántos días'}
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      )}
      <Textarea
        label="Texto de la advertencia"
        value={message}
        maxLength={1000}
        onChange={(event) => setMessage(event.target.value)}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button aria-disabled={sending} onClick={() => void save()}>
        {sending ? 'Guardando…' : 'Guardar regla'}
      </Button>
    </li>
  );
}
