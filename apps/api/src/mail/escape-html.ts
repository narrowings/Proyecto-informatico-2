const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// Todo texto que venga del usuario o de la base de datos pasa por aquí antes de ir al HTML del correo.
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ENTITIES[char]);
