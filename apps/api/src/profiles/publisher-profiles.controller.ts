import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { CreatePublisherProfileDto, PublisherDetailsDto } from './dto/create-publisher-profile.dto';
import { ProfilesService } from './profiles.service';

@Controller('profiles/publisher')
export class PublisherProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Post()
  @UseGuards(AuthenticatedGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePublisherProfileDto) {
    return this.profiles.createPublisherProfile(user.id, dto);
  }

  @Post('with-photo')
  @UseGuards(AuthenticatedGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
      // Busboy corta el archivo al alcanzar el límite. Una imagen de exactamente 5 MiB es válida.
      limits: { fileSize: 5 * 1024 * 1024 + 1, files: 1, fields: 7, fieldSize: 4096 },
    }),
  )
  createWithPhoto(
    @CurrentUser() user: AuthUser,
    @Body() details: PublisherDetailsDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/, overrideMimeType: true })
        .build({
          exceptionFactory: () =>
            new BadRequestException({
              errors: { photo: ['Selecciona una imagen JPG, PNG o WebP válida.'] },
            }),
        }),
    )
    photo: { buffer: Buffer; mimetype: string },
  ) {
    return this.profiles.createWithPhoto(user.id, details, photo);
  }

  @Get(':id/photo')
  @Header('X-Content-Type-Options', 'nosniff')
  async photo(@Param('id', ParseUUIDPipe) id: string) {
    const photo = await this.profiles.getPhoto(id);
    return new StreamableFile(photo.content, { type: photo.mediaType });
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.profiles.getOwnPublisherProfile(user.id);
  }

  @Get(':id')
  publicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.getPublicPublisherProfile(id);
  }
}
