import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { validateDto } from '../common/http/validate-dto';
import { AdminGuard } from './admin.guard';
import { AuditService } from './audit.service';
import { ListAuditQuery } from './dto/list-audit.query';

// HU-038 CA2: consulta de auditoría para administradores. No hay rutas para editar ni borrar (CA3).
@Controller('admin/audit')
@UseGuards(AuthenticatedGuard, AdminGuard)
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  list(@Query(validateDto(ListAuditQuery)) query: ListAuditQuery) {
    return this.audit.list(query);
  }
}
