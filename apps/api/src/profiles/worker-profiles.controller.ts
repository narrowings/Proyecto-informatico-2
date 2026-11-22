import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { validateDto } from '../common/http/validate-dto';
import { CreateWorkerProfileDto } from './dto/create-worker-profile.dto';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { photoInterceptor, photoPipe, type UploadedPhoto } from './photo';
import { WorkerProfilesService } from './worker-profiles.service';

@Controller('profiles/worker')
export class WorkerProfilesController {
  constructor(@Inject(WorkerProfilesService) private readonly workers: WorkerProfilesService) {}

  // HU-002 CA1: multipart/form-data con la foto y los datos del perfil en una sola petición.
  @Post()
  @UseGuards(AuthenticatedGuard)
  @UseInterceptors(photoInterceptor(6))
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWorkerProfileDto,
    @UploadedFile(photoPipe()) photo: UploadedPhoto,
  ) {
    return this.workers.create(user.id, dto, photo);
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.workers.getOwn(user.id);
  }

  // HU-032 CA1–CA2 y HU-030 CA4.
  @Patch('me')
  @UseGuards(AuthenticatedGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Body(validateDto(UpdateWorkerProfileDto)) dto: UpdateWorkerProfileDto,
  ) {
    return this.workers.update(user.id, dto);
  }

  @Put('me/photo')
  @UseGuards(AuthenticatedGuard)
  @UseInterceptors(photoInterceptor(0))
  replacePhoto(@CurrentUser() user: AuthUser, @UploadedFile(photoPipe()) photo: UploadedPhoto) {
    return this.workers.replacePhoto(user.id, photo);
  }

  // HU-029: perfil público del trabajador. Va después de "me" para que no se lea como id.
  @Get(':id')
  publicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.workers.getPublic(id);
  }

  // Pública: la foto se muestra en tarjetas y perfiles. nosniff evita que se interprete como HTML.
  @Get(':id/photo')
  @Header('X-Content-Type-Options', 'nosniff')
  async photo(@Param('id', ParseUUIDPipe) id: string) {
    const photo = await this.workers.getPhoto(id);
    return new StreamableFile(photo.content, { type: photo.mediaType });
  }
}
