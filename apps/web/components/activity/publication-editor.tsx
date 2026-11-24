'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import {
  activityApi,
  catalogsApi,
  type OwnedOpportunity,
  type OpportunityChanges,
  type Category,
  type Zone,
} from '@/lib/api';
import { ApiError } from '@/lib/api/http';
import { card, labels, Problem, Resource, useAction } from './activity-ui';

const catalogs = () => Promise.all([catalogsApi.listCategories(), catalogsApi.listZones()]);
const localMinute = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .format(new Date(iso))
        .replace(' ', 'T')
    : '';

function changedFields(data: FormData, p: OwnedOpportunity): OpportunityChanges {
  const changes: OpportunityChanges = {};
  for (const key of [
    'title',
    'description',
    'conditions',
    'experienceRequired',
    'requirements',
  ] as const) {
    if (!data.has(key)) continue;
    const value = String(data.get(key)).trim();
    if (value !== (p[key] ?? '')) changes[key] = value;
  }
  for (const key of [
    'categoryId',
    'zoneId',
    'durationMinutes',
    'peopleNeeded',
    'paymentCop',
    'salaryMinCop',
    'salaryMaxCop',
  ] as const) {
    if (!data.has(key)) continue;
    const current = key === 'categoryId' ? p.category.id : key === 'zoneId' ? p.zone.id : p[key];
    const value = data.get(key) === '' ? null : Number(data.get(key));
    if (value !== current) {
      if (key === 'salaryMaxCop' && value === null)
        changes.salaryMaxCop = Number(data.get('salaryMinCop'));
      else if (value !== null) changes[key] = value;
    }
  }
  for (const key of ['scheduledAt', 'closesAt'] as const) {
    const value = data.get(key);
    if (typeof value === 'string' && value !== localMinute(p[key]))
      changes[key] = new Date(value + ':00-05:00').toISOString();
  }
  const modality = data.get('modality');
  if (
    (modality === 'ONSITE' || modality === 'REMOTE' || modality === 'HYBRID') &&
    modality !== p.modality
  )
    changes.modality = modality;
  const schedule = data.get('schedule');
  if (
    (schedule === 'FULL_TIME' ||
      schedule === 'PART_TIME' ||
      schedule === 'SHIFTS' ||
      schedule === 'FLEXIBLE') &&
    schedule !== p.schedule
  )
    changes.schedule = schedule;
  return changes;
}

export function PublicationEditor({
  publication,
  onSaved,
}: {
  publication: OwnedOpportunity;
  onSaved: () => void;
}) {
  return (
    <Resource load={catalogs}>
      {([categories, zones]) => (
        <EditForm
          publication={publication}
          categories={categories}
          zones={zones}
          onSaved={onSaved}
        />
      )}
    </Resource>
  );
}

function EditForm({
  publication: p,
  categories,
  zones,
  onSaved,
}: {
  publication: OwnedOpportunity;
  categories: Category[];
  zones: Zone[];
  onSaved: () => void;
}) {
  const { run, busy, error } = useAction();
  const [warnings, setWarnings] = useState<{ message: string; code: string }[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [salaryMin, setSalaryMin] = useState(p.salaryMinCop ?? 1);
  const api = error instanceof ApiError ? error : undefined;
  const fieldError = (name: string) => api?.problem.errors?.[name]?.[0];
  const formal = p.type === 'FORMAL_JOB';
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const changes = changedFields(new FormData(event.currentTarget), p);
    if (!Object.keys(changes).length) {
      onSaved();
      return;
    }
    if (warnings.length && !acknowledged) return;
    void run(async () => {
      try {
        await activityApi.update(
          p.id,
          acknowledged ? { ...changes, acknowledgeLaborWarning: true } : changes,
        );
        onSaved();
      } catch (e) {
        if (
          e instanceof ApiError &&
          e.problem.code === 'LABOR_WARNING_REQUIRED' &&
          e.problem.warnings?.length
        ) {
          setWarnings(e.problem.warnings);
          setAcknowledged(false);
          return;
        }
        throw e;
      }
    });
  }
  return (
    <form className={card} onSubmit={submit}>
      <fieldset
        disabled={busy}
        className="flex min-w-0 flex-col gap-3"
        onChange={() => {
          setWarnings([]);
          setAcknowledged(false);
        }}
      >
        <legend className="mb-3 font-bold">Editar {labels[p.type].toLowerCase()}</legend>
        <Field
          label="Título"
          name="title"
          required
          minLength={5}
          maxLength={120}
          defaultValue={p.title}
          error={fieldError('title')}
        />
        <Textarea
          label="Descripción"
          name="description"
          required
          minLength={20}
          maxLength={3000}
          defaultValue={p.description}
          error={fieldError('description')}
        />
        <Select
          name="categoryId"
          label="Categoría"
          required
          defaultValue={categories.some((c) => c.id === p.category.id) ? p.category.id : ''}
          error={fieldError('categoryId')}
        >
          <option value="">Elige la categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          name="zoneId"
          label="Zona"
          required
          defaultValue={zones.some((z) => z.id === p.zone.id) ? p.zone.id : ''}
          error={fieldError('zoneId')}
        >
          <option value="">Elige la zona</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </Select>
        {formal ? (
          <>
            <Field
              label="Salario mínimo (COP)"
              name="salaryMinCop"
              required
              type="number"
              min={1}
              max={100000000}
              defaultValue={p.salaryMinCop ?? ''}
              onChange={(event) => setSalaryMin(Number(event.target.value))}
              error={fieldError('salaryMinCop')}
            />
            <Field
              label="Salario máximo (COP)"
              name="salaryMaxCop"
              hint="Para un salario fijo, usa el mismo valor del mínimo."
              type="number"
              min={Math.max(1, salaryMin)}
              max={100000000}
              defaultValue={p.salaryMaxCop ?? ''}
              error={fieldError('salaryMaxCop')}
            />
            <Select
              label="Modalidad"
              name="modality"
              defaultValue={p.modality ?? ''}
              error={fieldError('modality')}
            >
              {(['ONSITE', 'REMOTE', 'HYBRID'] as const).map((m) => (
                <option key={m} value={m}>
                  {labels[m]}
                </option>
              ))}
            </Select>
            <Select
              label="Jornada"
              name="schedule"
              defaultValue={p.schedule ?? ''}
              error={fieldError('schedule')}
            >
              {(['FULL_TIME', 'PART_TIME', 'SHIFTS', 'FLEXIBLE'] as const).map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </Select>
            <Textarea
              label="Experiencia requerida"
              name="experienceRequired"
              required
              maxLength={500}
              defaultValue={p.experienceRequired ?? ''}
              error={fieldError('experienceRequired')}
            />
            <Textarea
              label="Requisitos"
              name="requirements"
              required
              maxLength={2000}
              defaultValue={p.requirements ?? ''}
              error={fieldError('requirements')}
            />
            <Field
              label="Cierre de la vacante (hora de Cali)"
              type="datetime-local"
              name="closesAt"
              min={localMinute(new Date().toISOString())}
              required
              defaultValue={localMinute(p.closesAt)}
              error={fieldError('closesAt')}
            />
          </>
        ) : (
          <>
            <Field
              label="Personas necesarias"
              type="number"
              required
              name="peopleNeeded"
              min={1}
              max={50}
              defaultValue={p.peopleNeeded ?? ''}
              error={fieldError('peopleNeeded')}
            />
            <Field
              label="Pago ofrecido (COP)"
              type="number"
              required
              name="paymentCop"
              min={1}
              max={100000000}
              defaultValue={p.paymentCop ?? ''}
              error={fieldError('paymentCop')}
            />
            <Field
              label="Fecha y hora de realización (Cali)"
              type="datetime-local"
              name="scheduledAt"
              min={localMinute(new Date().toISOString())}
              required
              defaultValue={localMinute(p.scheduledAt)}
              error={fieldError('scheduledAt')}
            />
            <Field
              label="Duración en minutos"
              type="number"
              required
              name="durationMinutes"
              min={15}
              max={525600}
              defaultValue={p.durationMinutes ?? ''}
              error={fieldError('durationMinutes')}
            />
          </>
        )}
        <Textarea
          label="Condiciones"
          name="conditions"
          maxLength={1000}
          defaultValue={p.conditions ?? ''}
          error={fieldError('conditions')}
        />
      </fieldset>
      {warnings.length > 0 && (
        <div role="alert" className="flex flex-col gap-2">
          {warnings.map((w) => (
            <p key={w.code}>{w.message}</p>
          ))}
          <Checkbox
            label="Leí la advertencia sobre relación laboral"
            checked={acknowledged}
            disabled={busy}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
        </div>
      )}
      {error ? <Problem error={error} /> : null}
      <Button type="submit" disabled={busy || (warnings.length > 0 && !acknowledged)}>
        Guardar cambios
      </Button>
    </form>
  );
}
