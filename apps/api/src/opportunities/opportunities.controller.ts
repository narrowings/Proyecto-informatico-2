import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { ListOpportunitiesQuery, PageQuery } from './dto/list-opportunities.query';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { OpportunitiesService } from './opportunities.service';

class ExactAddressDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(300, { message: 'La dirección admite máximo 300 caracteres' })
  @IsString({ message: 'Escribe la dirección' })
  address!: string;
}

const id = new ParseUUIDPipe({ version: '4' });

@Controller('opportunities')
export class OpportunitiesController {
  constructor(@Inject(OpportunitiesService) private readonly opportunities: OpportunitiesService) {}

  // HU-009 y HU-010: feed con búsqueda y filtros. Público, como el perfil público del publicador.
  @Get()
  // Con sesión (opcional), no muestra lo que el propio usuario reportó (RF-04-06).
  list(@Query() query: ListOpportunitiesQuery, @CurrentUser() viewer?: AuthUser) {
    return this.opportunities.listFeed(query, new Date(), viewer?.id);
  }

  // HU-023 CA1. Va antes de :id para que "mine" no se lea como id.
  @Get('mine')
  @UseGuards(AuthenticatedGuard)
  mine(@CurrentUser() user: AuthUser, @Query() query: PageQuery) {
    return this.opportunities.listMine(user.id, query);
  }

  @Get('mine/:id')
  @UseGuards(AuthenticatedGuard)
  own(@CurrentUser() user: AuthUser, @Param('id', id) opportunityId: string) {
    return this.opportunities.getOwn(user.id, opportunityId);
  }

  // HU-026: detalle público.
  @Get(':id')
  detail(@Param('id', id) opportunityId: string) {
    return this.opportunities.getPublic(opportunityId);
  }

  // HU-003 CA2: el frontend consulta la advertencia laboral antes de publicar.
  @Post('labor-warnings')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  async laborWarnings(@Body() dto: CreateOpportunityDto) {
    return { warnings: await this.opportunities.previewLaborWarnings(dto) };
  }

  // RNF-SEG-08: máximo 10 publicaciones por IP cada 15 minutos, contra publicaciones masivas.
  @Post()
  @UseGuards(AuthenticatedGuard, ThrottlerGuard)
  @Throttle({ ip: { limit: 10 } })
  @SkipThrottle({ email: true })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOpportunityDto) {
    return this.opportunities.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(AuthenticatedGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', id) opportunityId: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunities.update(user.id, opportunityId, dto);
  }

  @Put(':id/address')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard)
  async address(
    @CurrentUser() user: AuthUser,
    @Param('id', id) opportunityId: string,
    @Body() dto: ExactAddressDto,
  ) {
    await this.opportunities.setExactAddress(user.id, opportunityId, dto.address);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  pause(
    @CurrentUser() user: AuthUser,
    @Param('id', id) opportunityId: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.opportunities.pause(user.id, opportunityId, dto.reason);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  resume(@CurrentUser() user: AuthUser, @Param('id', id) opportunityId: string) {
    return this.opportunities.resume(user.id, opportunityId);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  close(
    @CurrentUser() user: AuthUser,
    @Param('id', id) opportunityId: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.opportunities.close(user.id, opportunityId, dto.reason);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', id) opportunityId: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.opportunities.cancel(user.id, opportunityId, dto.reason);
  }
}
