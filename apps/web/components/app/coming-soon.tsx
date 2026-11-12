import { Alert } from '@/components/ui/alert';

/** Pantalla de destino provisional mientras se construye su historia de usuario. */
export function ComingSoon({ title, children }: { title: string; children: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl leading-tight font-bold">{title}</h1>
      <Alert tone="info">{children}</Alert>
    </div>
  );
}
