import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { clearRefreshCookie, readCookie, REFRESH_COOKIE, setRefreshCookie } from './cookies';
import { LoginDto } from './dto/login.dto';
import { SessionService, type SessionMeta } from './session.service';

const metaOf = (request: Request): SessionMeta => ({
  ip: request.ip,
  userAgent: request.headers['user-agent'],
});

@Controller('auth')
export class SessionController {
  private readonly secureCookie: boolean;

  constructor(
    private readonly session: SessionService,
    config: ConfigService,
  ) {
    this.secureCookie = config.get<string>('NODE_ENV') === 'production';
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refreshToken, ...session } = await this.session.login(dto, metaOf(request));
    setRefreshCookie(response, refreshToken, this.secureCookie);
    return session;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    try {
      const cookie = readCookie(request.headers.cookie, REFRESH_COOKIE);
      const { refreshToken, ...session } = await this.session.refresh(cookie, metaOf(request));
      setRefreshCookie(response, refreshToken, this.secureCookie);
      return session;
    } catch (error) {
      clearRefreshCookie(response, this.secureCookie);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.session.logout(readCookie(request.headers.cookie, REFRESH_COOKIE));
    clearRefreshCookie(response, this.secureCookie);
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.session.me(user.id);
  }
}