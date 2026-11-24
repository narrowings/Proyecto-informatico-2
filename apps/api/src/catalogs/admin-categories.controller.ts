import {
  Body,
  Controller,
  Get,
  Inject,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../audit/admin.guard';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { type AuthUser, CurrentUser } from '../common/auth/current-user.decorator';
import { validateDto } from '../common/http/validate-dto';
import { AdminCategoriesService } from './admin-categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

// HU-037: gestión de categorías desde el panel de administración.
@Controller('admin/categories')
@UseGuards(AuthenticatedGuard, AdminGuard)
export class AdminCategoriesController {
  constructor(
    @Inject(AdminCategoriesService) private readonly categories: AdminCategoriesService,
  ) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(validateDto(CreateCategoryDto)) dto: CreateCategoryDto,
    @Ip() ip: string,
  ) {
    return this.categories.create(dto, { userId: user.id, ip });
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body(validateDto(UpdateCategoryDto)) dto: UpdateCategoryDto,
    @Ip() ip: string,
  ) {
    return this.categories.update(id, dto, { userId: user.id, ip });
  }
}
