'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { adminApi } from '@/lib/api';
import { adminResultMessage, type AdminCategory, type CategoryInput } from '@/lib/api/admin';
import { AdminStates } from './admin-states';
import { useAdminData } from './use-admin-data';

/** Valida nombre (3–100) y descripción (≤ 300) antes de enviar. */
export const categoryError = (name: string, description: string) => {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 100)
    return 'El nombre debe tener entre 3 y 100 caracteres.';
  if (description.trim().length > 300) return 'La descripción admite hasta 300 caracteres.';
  return null;
};

/** HU-037: crear, editar y activar/desactivar categorías. */
export function CategoriesPanel() {
  const { state, reload } = useAdminData(() => adminApi.categories(), []);
  const [notice, setNotice] = useState<string>();
  const save = async (run: () => Promise<Parameters<typeof adminResultMessage>[0]>, ok: string) => {
    const result = await run().catch(() => null);
    const error = result ? adminResultMessage(result) : 'No pudimos guardar. Inténtalo de nuevo.';
    if (!error) {
      setNotice(ok);
      reload();
    }
    return error;
  };
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-bold">Categorías</h2>
      <p className="text-sm text-muted">
        Desactivar una categoría solo la quita del formulario de publicación: las publicaciones
        existentes conservan su categoría.
      </p>
      <CategoryForm
        submitLabel="Crear categoría"
        onSubmit={(input) => save(() => adminApi.createCategory(input), 'Categoría creada.')}
      />
      <div aria-live="polite">{notice ? <Alert tone="success">{notice}</Alert> : null}</div>
      <AdminStates
        state={state}
        reload={reload}
        isEmpty={(data) => data.length === 0}
        empty="Todavía no hay categorías."
      >
        {(categories) => (
          <ul className="flex flex-col gap-3">
            {categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onSave={(input, ok) => save(() => adminApi.updateCategory(category.id, input), ok)}
              />
            ))}
          </ul>
        )}
      </AdminStates>
    </section>
  );
}

function CategoryRow({
  category,
  onSave,
}: {
  category: AdminCategory;
  onSave: (input: CategoryInput, ok: string) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (editing)
    return (
      <li className="rounded-card border border-line p-4">
        <CategoryForm
          initial={category}
          submitLabel="Guardar cambios"
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            const result = await onSave(input, 'Categoría actualizada.');
            if (!result) setEditing(false);
            return result;
          }}
        />
      </li>
    );
  return (
    <li className="rounded-card border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{category.name}</strong>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${category.isActive ? 'bg-brand-soft text-brand-dark' : 'bg-line text-muted'}`}
        >
          {category.isActive ? 'Activa' : 'Inactiva'}
        </span>
      </div>
      {category.description ? <p className="text-sm">{category.description}</p> : null}
      <p className="text-xs text-muted">
        {category.opportunities} {category.opportunities === 1 ? 'publicación' : 'publicaciones'}
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-field border border-line px-3 text-sm font-bold"
          onClick={() => setEditing(true)}
        >
          Editar
        </button>
        <button
          type="button"
          className="min-h-11 rounded-field border border-line px-3 text-sm font-bold"
          onClick={async () =>
            setError(
              await onSave(
                { isActive: !category.isActive },
                category.isActive ? 'Categoría desactivada.' : 'Categoría activada.',
              ),
            )
          }
        >
          {category.isActive ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </li>
  );
}

function CategoryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: AdminCategory;
  submitLabel: string;
  onSubmit: (input: CategoryInput) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = categoryError(name, description);
    if (invalid) return setError(invalid);
    if (sending) return;
    setSending(true);
    const result = await onSubmit({ name: name.trim(), description: description.trim() || null });
    setSending(false);
    setError(result);
    if (!result && !initial) {
      setName('');
      setDescription('');
    }
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field
        label="Nombre"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        label="Descripción (opcional)"
        value={description}
        maxLength={300}
        onChange={(e) => setDescription(e.target.value)}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" aria-disabled={sending}>
          {sending ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
