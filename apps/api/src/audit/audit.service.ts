import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditContract, AuditInput } from './audit.contract';
import type { ListAuditQuery } from './dto/list-audit.query';

const truncate = (value: string | undefined, max: number) =>
  value === undefined ? undefined : [...value].slice(0, max).join('');

// HU-038: registro de auditoría de solo inserción. La base rechaza UPDATE, DELETE y TRUNCATE
// (trigger de la migración), así que aquí solo se inserta y se consulta.
@Injectable()
export class AuditService implements AuditContract {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: AuditInput, tx: Prisma.TransactionClient = this.prisma) {
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: truncate(input.targetType, 40),
        targetId: truncate(input.targetId, 64),
        reason: truncate(input.reason, 500),
        ip: truncate(input.ip, 45),
        data: input.data ?? {},
      },
    });
  }

  // HU-038 CA2: consulta por fecha, usuario y tipo de evento; lo más reciente primero.
  async list({ page, pageSize, from, to, actorUserId, action }: ListAuditQuery) {
    const where: Prisma.AuditLogWhereInput = {
      ...(actorUserId && { actorUserId }),
      ...(action && { action }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }
}
