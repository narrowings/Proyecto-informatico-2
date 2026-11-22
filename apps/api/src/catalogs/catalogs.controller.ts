import { Controller, Get, Header, Inject } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';

// Públicos: el formulario de registro de perfil y los filtros del feed los usan antes de iniciar sesión.
// Cambian poco, así que el navegador y el CDN pueden guardarlos 5 minutos.
@Controller()
export class CatalogsController {
  constructor(@Inject(CatalogsService) private readonly catalogs: CatalogsService) {}

  @Get('zones')
  @Header('Cache-Control', 'public, max-age=300')
  zones() {
    return this.catalogs.listZones();
  }

  @Get('categories')
  @Header('Cache-Control', 'public, max-age=300')
  categories() {
    return this.catalogs.listCategories();
  }
}
