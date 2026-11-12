'use client';

import { useId, useState, type KeyboardEvent, type Ref } from 'react';
import { addSkills, MAX_SKILL_LENGTH, MAX_SKILLS } from '@/lib/profiles/worker-schema';

type SkillsInputProps = {
  value: string[];
  onChange(skills: string[]): void;
  onBlur?(): void;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
};

/**
 * Habilidades como etiquetas: se escriben y se agregan con Enter, coma, el
 * botón "Agregar" o al salir del campo; cada una se quita con su propio botón.
 */
export function SkillsInput({ value, onChange, onBlur, error, inputRef }: SkillsInputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [draft, setDraft] = useState('');
  const full = value.length >= MAX_SKILLS;

  function commit() {
    onChange(addSkills(value, [draft]));
    setDraft('');
  }

  // La coma se detecta en el texto y no en la tecla: muchos teclados de Android
  // no reportan la tecla pulsada ("Unidentified").
  function onDraftChange(text: string) {
    if (!text.includes(',')) {
      setDraft(text);
      return;
    }
    const parts = text.split(',');
    const rest = parts.pop() ?? '';
    onChange(addSkills(value, parts));
    setDraft(rest);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold">
        Habilidades
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={id}
          value={draft}
          maxLength={MAX_SKILL_LENGTH}
          disabled={full}
          placeholder="Ej.: Logística, montaje de eventos"
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            // Lo escrito sin Enter no se pierde al tocar otro campo o "Guardar perfil".
            if (draft.trim()) commit();
            onBlur?.();
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          className={`h-12 min-w-0 flex-1 rounded-field border bg-white px-3.5 text-[15px] text-ink focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:bg-canvas ${
            error ? 'border-danger' : 'border-line'
          }`}
        />
        <button
          type="button"
          onClick={commit}
          disabled={full}
          className="h-12 shrink-0 rounded-field border border-line bg-white px-4 text-[15px] font-bold text-ink hover:bg-brand-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:text-muted"
        >
          Agregar
        </button>
      </div>
      <p id={hintId} className="text-[13px] text-muted">
        Agrega al menos una. Máximo {MAX_SKILLS}.
      </p>
      {value.length > 0 ? (
        <ul aria-label="Habilidades agregadas" className="flex flex-wrap gap-2 pt-1">
          {value.map((skill) => (
            <li
              key={skill}
              className="flex items-center gap-1 rounded-full bg-brand-soft py-1 pr-1 pl-3 text-[13px] font-medium text-brand-dark"
            >
              {skill}
              <button
                type="button"
                aria-label={`Quitar ${skill}`}
                onClick={() => onChange(value.filter((s) => s !== skill))}
                // 44 px de área táctil; el margen negativo mantiene la etiqueta compacta.
                className="-my-2 -mr-1 flex size-11 items-center justify-center rounded-full hover:bg-white/60 focus-visible:outline-3 focus-visible:outline-brand"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p id={errorId} className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
