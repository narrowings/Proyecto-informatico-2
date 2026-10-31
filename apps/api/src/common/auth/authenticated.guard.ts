import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './current-user.decorator';

// Exige un usuario autenticado en la solicitud. La validación del JWT que llena `request.user`
// la agrega HU-021 (Juan José Baloco); mientras tanto toda ruta protegida responde 401.
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException();
    return true;
  }
}
