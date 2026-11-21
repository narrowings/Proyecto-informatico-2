import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { PaginationDto } from '../common/http/pagination.dto';
import { uuidPipe } from '../common/http/uuid';
import { validateDto } from '../common/http/validate-dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthenticatedGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  listOwn(@CurrentUser() user: AuthUser, @Query(validateDto(PaginationDto)) query: PaginationDto) {
    return this.notifications.listOwn(user.id, query);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.getUnreadCount(user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(@CurrentUser() user: AuthUser, @Param('id', uuidPipe) id: string) {
    return this.notifications.markAsRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllAsRead(user.id);
  }
}
