import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { CreatePublisherProfileDto } from './dto/create-publisher-profile.dto';
import { ProfilesService } from './profiles.service';

@Controller('profiles/publisher')
export class PublisherProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Post()
  @UseGuards(AuthenticatedGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePublisherProfileDto) {
    return this.profiles.createPublisherProfile(user.id, dto);
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
