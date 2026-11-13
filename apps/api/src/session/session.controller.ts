import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import {
  clearRefreshCookie,
  isSecureCookie,
  readCookie,
  REFRESH_COOKIE,
  setRefreshCookie,
} from './cookies';
import { LoginDto } from './dto/login.dto';
import { SessionService, type SessionMeta } from './session.service';

const MINUTE_MS = 60_000;

const metaOf = (request: Request): SessionMeta => ({
  ip: request.ip,
  userAgent: request.headers['user-agent'],
});

@Controller('auth')
export class SessionController {
  private readonly secureCookie: boolean;

  constructor(
    // @Inject explícito: funciona igual en las pruebas, donde Vitest no emite la metadata de tipos.
    @Inject(SessionService) private readonly session: SessionService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.secureCookie = isSecureCookie(config.get<string>('NODE_ENV'));
  }

  // RNF-SEG-08 (revisión PR #5, 3.1): Argon2id es costoso a propósito; máximo 5 intentos por IP
  // por minuto para que no se pueda agotar la CPU. Sin límite por correo: dejaría a un tercero
  // bloquear el acceso de otra persona.
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ ip: { limit: 5, ttl: MINUTE_MS } })
  @SkipThrottle({ email: true })
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

  // RNF-SEG-08: máximo 10 renovaciones por IP por minuto. Logout no lleva límite.
  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @Throttle({ ip: { limit: 10, ttl: MINUTE_MS } })
  @SkipThrottle({ email: true })
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