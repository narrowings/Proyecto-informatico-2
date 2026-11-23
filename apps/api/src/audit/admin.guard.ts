import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator';
import { IdentityService } from '../identity/identity.service';
import { AUDIT, type AuditContract } from './audit.contract';

export const ADMIN_ONLY = {
  code: 'ADMIN_ONLY',
  message: 'Esta sección es solo para administradores',
};

// HU-012 CA2 / RF-09-01: solo el rol Administrador entra al panel, y cada intento denegado queda en
// la auditoría. El rol se lee de la base en cada petición: quitarlo surte efecto de inmediato, sin
// esperar a que venza el token. Usar después de AuthenticatedGuard: @UseGuards(AuthenticatedGuard, AdminGuard).
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(AUDIT) private readonly audit: AuditContract,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException();
    const access = await this.identity.getAccess(request.user.id);
    if (access?.role === UserRole.ADMIN && access.status === 'ACTIVE') return true;
    await this.audit.record({
      actorUserId: request.user.id,
      action: 'ADMIN_ACCESS_DENIED',
      targetType: 'route',
      targetId: `${request.method} ${request.route?.path ?? request.path}`.slice(0, 64),
      ip: request.ip,
    });
    throw new ForbiddenException(ADMIN_ONLY);
  }
}
