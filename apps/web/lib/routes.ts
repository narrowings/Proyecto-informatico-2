export const ROUTES = {
  /** Pantalla de selección de intención (HU-022); hoy es la página provisional. */
  home: '/',
  register: '/registro',
  registerPending: '/registro/pendiente',
  confirmEmail: '/confirmar-correo',
  login: '/iniciar-sesion',
  /** Aceptación de nuevas versiones de términos y política al iniciar sesión (HU-017 CA4). */
  acceptTerms: '/aceptar-terminos',
  terms: '/terminos',
  privacy: '/privacidad',
  dataProcessing: '/tratamiento-datos',
} as const;
