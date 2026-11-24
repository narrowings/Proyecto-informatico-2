/**
 * true solo para rutas de esta misma aplicación ("/mi-actividad"). Rechaza "//otro.com" y "/\\otro.com",
 * que el navegador trata como enlaces a otro sitio (redirección abierta).
 */
export const isInternalPath = (link: string | null | undefined): link is string =>
  typeof link === 'string' && /^\/(?![/\\])/.test(link);
