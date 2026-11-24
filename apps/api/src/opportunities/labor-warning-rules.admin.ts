import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Ip,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AdminGuard } from '../audit/admin.guard';
import { AUDIT, type AuditContract } from '../audit/audit.contract';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { type AuthUser, CurrentUser } from '../common/auth/current-user.decorator';
import { validateDto } from '../common/http/validate-dto';
import { PrismaService } from '../prisma/prisma.service';
import { serializableTransaction } from '../prisma/serializable-transaction';
import { UpdateLaborWarningRuleDto } from './dto/labor-warning-rule.dto';

const DAY = 24 * 60;
const minutes = (min: number, max: number, label: string) => (params: Record<string, unknown>) => {
  const value = params.minMinutes;
  if (Object.keys(params).some((key) => key !== 'minMinutes')) return 'Solo se admite minMinutes';
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    return `minMinutes debe ser un entero entre ${min} y ${max} (${label})`;
  }
  return null;
};

// Forma de `params` por código; null si es válida o el mensaje de error.
const PARAM_VALIDATORS: Record<string, (params: Record<string, unknown>) => string | null> = {
  FULL_DAY: minutes(60, DAY, 'de 1 a 24 horas'),
  LONG_TERM: minutes(DAY, 365 * DAY, 'de 1 a 365 días'),
  SUBORDINATION_TERMS: (params) => {
    const terms = params.terms;
    if (Object.keys(params).some((key) => key !== 'terms')) return 'Solo se admite terms';
    if (
      !Array.isArray(terms) ||
      terms.length < 1 ||
      terms.length > 50 ||
      terms.some((term) => typeof term !== 'string' || term.trim().length < 2 || term.length > 60)
    ) {
      return 'terms debe ser una lista de 1 a 50 expresiones de 2 a 60 caracteres';
    }
    return null;
  },
};

const select = {
  code: true,
  message: true,
  params: true,
  isActive: true,
  updatedAt: true,
} as const;

@Injectable()
export class LaborWarningRulesAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT) private readonly audit: AuditContract,
  ) {}

  list() {
    return this.prisma.laborWarningRule.findMany({ select, orderBy: { code: 'asc' } });
  }

  async update(
    code: string,
    dto: UpdateLaborWarningRuleDto,
    actor: { userId: string; ip?: string },
  ) {
    const validate = PARAM_VALIDATORS[code];
    if (!validate) throw new NotFoundException();
    const error = dto.params && validate(dto.params);
    if (error) {
      throw new BadRequestException({
        message: 'Revisa los campos marcados',
        errors: { params: [error] },
      });
    }
    const params =
      dto.params && code === 'SUBORDINATION_TERMS'
        ? { terms: (dto.params.terms as string[]).map((term) => term.trim()) }
        : dto.params;
    return serializableTransaction(this.prisma, async (tx) => {
      const current = await tx.laborWarningRule.findUnique({ where: { code }, select });
      if (!current) throw new NotFoundException();
      const rule = await tx.laborWarningRule.update({
        where: { code },
        data: {
          ...(dto.message !== undefined && { message: dto.message }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(params && { params: params as Prisma.InputJsonValue }),
        },
        select,
      });
      const changed = [
        dto.message !== undefined && dto.message !== current.message && 'message',
        dto.isActive !== undefined && dto.isActive !== current.isActive && 'isActive',
        params && JSON.stringify(params) !== JSON.stringify(current.params) && 'params',
      ].filter((field): field is string => typeof field === 'string');
      if (changed.length > 0) {
        await this.audit.record(
          {
            actorUserId: actor.userId,
            action: 'LABOR_RULE_UPDATED',
            targetType: 'labor_warning_rule',
            targetId: code,
            ip: actor.ip,
            data: { changed: changed.join(','), isActive: rule.isActive },
          },
          tx,
        );
      }
      return rule;
    });
  }
}

// RF-03-05: reglas de advertencia laboral administrables (umbrales y texto aprobado por jurídica).
@Controller('admin/labor-warning-rules')
@UseGuards(AuthenticatedGuard, AdminGuard)
export class LaborWarningRulesAdminController {
  constructor(
    @Inject(LaborWarningRulesAdminService) private readonly rules: LaborWarningRulesAdminService,
  ) {}

  @Get()
  list() {
    return this.rules.list();
  }

  @Patch(':code')
  update(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
    @Body(validateDto(UpdateLaborWarningRuleDto)) dto: UpdateLaborWarningRuleDto,
    @Ip() ip: string,
  ) {
    return this.rules.update(code, dto, { userId: user.id, ip });
  }
}
