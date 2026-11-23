export const ROUTES = {
  /** Pantalla de selección de intención (HU-022). */
  home: '/',
  /** "Quiero trabajar": oportunidades (feed en el Sprint 2). */
  work: '/trabajar',
  /** "Necesito ayuda": publicar una necesidad. */
  publish: '/publicar',
  /** "Mi actividad" (HU-013). */
  activity: '/mi-actividad',
  /** "Mi perfil": editar, disponibilidad y privacidad (HU-032, HU-030). */
  myProfile: '/perfil',
  /** Crear el perfil de trabajador (HU-002). */
  workerProfile: '/perfil/trabajador',
  /** Crear el perfil de publicador o empresa (HU-008, pantalla de Diego Quintero). */
  publisherProfile: '/perfil/publicador',
  register: '/registro',
  registerPending: '/registro/pendiente',
  confirmEmail: '/confirmar-correo',
  login: '/iniciar-sesion',
  /** "Olvidé mi contraseña" (HU-018). */
  forgotPassword: '/olvide-contrasena',
  /** Enlace del correo de recuperación: la ruta es obligatoria tal cual (HU-018). */
  resetPassword: '/restablecer-contrasena',
  /** Aceptación de nuevas versiones de términos y política al iniciar sesión (HU-017 CA4). */
  acceptTerms: '/aceptar-terminos',
  terms: '/terminos',
  privacy: '/privacidad',
  dataProcessing: '/tratamiento-datos',
} as const;

/** Perfil público de un trabajador (HU-029). */
export const workerPublicPath = (id: string) => `/trabajadores/${encodeURIComponent(id)}`;
