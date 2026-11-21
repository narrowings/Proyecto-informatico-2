import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { CreateWorkerProfileDto } from './dto/create-worker-profile.dto';
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

  // Pública: la foto se muestra en tarjetas y perfiles. nosniff evita que se interprete como HTML.
  @Get(':id/photo')
  @Header('X-Content-Type-Options', 'nosniff')
  async photo(@Param('id', ParseUUIDPipe) id: string) {
    const photo = await this.workers.getPhoto(id);
    return new StreamableFile(photo.content, { type: photo.mediaType });
  }
}
