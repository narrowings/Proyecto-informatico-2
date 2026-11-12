import type { Metadata } from 'next';
import { IntentScreen } from '@/components/intent/intent-screen';

export const metadata: Metadata = {
  title: 'Inicio | Red de Oportunidades Laborales Cali',
};

/** Selección de intención (HU-022). */
export default function InicioPage() {
  return <IntentScreen />;
}
