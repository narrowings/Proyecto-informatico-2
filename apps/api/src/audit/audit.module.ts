import { Global, Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminGuard } from './admin.guard';
import { AUDIT } from './audit.contract';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

// Global: cualquier módulo registra eventos con AUDIT y protege rutas con AdminGuard.
@Global()
@Module({
  imports: [IdentityModule],
  controllers: [AuditController],
  providers: [AuditService, { provide: AUDIT, useExisting: AuditService }, AdminGuard],
  exports: [AUDIT, AuditService, AdminGuard, IdentityModule],
})
export class AuditModule {}
