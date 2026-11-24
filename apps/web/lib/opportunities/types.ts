import type { OpportunityType } from '@/lib/api';

/**
 * Tipos de oportunidad y su breve explicación (HU-025 CA2). Los textos de ayuda son
 * una propuesta del equipo de desarrollo; las HU no los fijan.
 */
export const OPPORTUNITY_TYPES: {
  value: OpportunityType;
  label: string;
  description: string;
}[] = [
  {
    value: 'TASK',
    label: 'Tarea',
    description: 'Una actividad puntual y sencilla, como una diligencia o cargar unas cajas.',
  },
  {
    value: 'QUICK_JOB',
    label: 'Trabajo rápido',
    description: 'Algo urgente que se resuelve en pocas horas o en el mismo día.',
  },
  {
    value: 'PROJECT',
    label: 'Proyecto',
    description: 'Un trabajo con un resultado definido y más duración, como pintar un local.',
  },
  {
    value: 'SERVICE',
    label: 'Servicio',
    description:
      'Una prestación especializada que se contrata por su resultado, como una reparación.',
  },
  {
    value: 'FORMAL_JOB',
    label: 'Empleo formal',
    description: 'Una vacante con contrato laboral, salario y horario, con su propio formulario.',
  },
];
