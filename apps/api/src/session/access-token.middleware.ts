import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator';
import { AccessTokenService } from './access-token.service';

// Llena `request.user` cuando llega un token de acceso válido. Nunca rechaza: las rutas protegidas
// usan AuthenticatedGuard, que responde 401 si `request.user` quedó vacío.
@Injectable()
export class AccessTokenMiddleware implements NestMiddleware {
  constructor(private readonly tokens: AccessTokenService) {}

  async use(request: AuthenticatedRequest, _response: Response, next: () => void) {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const userId = await this.tokens.verify(header.slice('Bearer '.length));
      if (userId) request.user = { id: userId };
    }
    next();
  }
}