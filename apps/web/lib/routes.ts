export const ROUTES = {
  /** Pantalla de selección de intención (HU-022). */
  home: '/',
  /** "Quiero trabajar": oportunidades (feed en el Sprint 2). */
  work: '/trabajar',
  /** "Necesito ayuda": publicar una necesidad. */
  publish: '/publicar',
  /** "Mi actividad" (HU-013). */
  activity: '/mi-actividad',
  /** Crear el perfil de trabajador (HU-002). */
  workerProfile: '/perfil/trabajador',
  /** Crear el perfil de publicador o empresa (HU-008, pantalla de Diego Quintero). */
  publisherProfile: '/perfil/publicador',
  register: '/registro',
  registerPending: '/registro/pendiente',
  confirmEmail: '/confirmar-correo',
  login: '/iniciar-sesion',
  terms: '/terminos',
  privacy: '/privacidad',
  dataProcessing: '/tratamiento-datos',
} as const;
