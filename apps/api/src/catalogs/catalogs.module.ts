import { Module } from '@nestjs/common';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminCategoriesService } from './admin-categories.service';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';

@Module({
  controllers: [CatalogsController, AdminCategoriesController],
  providers: [CatalogsService, AdminCategoriesService],
  exports: [CatalogsService],
})
export class CatalogsModule {}
