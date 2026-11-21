import {
  Body,
  Controller,
  Get,
  Header,
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
import { CreatePublisherProfileDto, PublisherDetailsDto } from './dto/create-publisher-profile.dto';
import { photoInterceptor, photoPipe, type UploadedPhoto } from './photo';
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
  @UseInterceptors(photoInterceptor(7))
  createWithPhoto(
    @CurrentUser() user: AuthUser,
    @Body() details: PublisherDetailsDto,
    @UploadedFile(photoPipe()) photo: UploadedPhoto,
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
