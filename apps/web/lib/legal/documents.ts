/**
 * Textos legales publicados (HU-017). Los archivos están en apps/web/content/legal y se exportan del
 * Word que entrega asesoría jurídica. La API guarda la versión aceptada y la URL de cada uno
 * (tabla legal_documents); estas rutas deben coincidir con esa URL.
 */
export const LEGAL_DOCUMENTS = {
  terminos: { file: 'terminos.md', title: 'Términos y condiciones' },
  privacidad: { file: 'privacidad.md', title: 'Política de privacidad' },
  'autorizacion-datos': {
    file: 'autorizacion-datos.md',
    title: 'Autorización de tratamiento de datos personales',
  },
  'mayoria-edad': { file: 'mayoria-edad.md', title: 'Declaración de mayoría de edad' },
} as const;

export type LegalSlug = keyof typeof LEGAL_DOCUMENTS;

export const legalPath = (slug: LegalSlug) => `/legal/${slug}`;
