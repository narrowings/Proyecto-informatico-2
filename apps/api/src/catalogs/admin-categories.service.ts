import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AUDIT, type AuditContract } from '../audit/audit.contract';
import { PrismaService } from '../prisma/prisma.service';
import { isPrismaError, serializableTransaction } from '../prisma/serializable-transaction';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

export const CATEGORY_EXISTS = {
  code: 'CATEGORY_EXISTS',
  message: 'Ya existe una categoría con ese nombre',
};

const select = { id: true, name: true, description: true, isActive: true } as const;

type Actor = { userId: string; ip?: string };

// HU-037: el administrador crea, edita y desactiva categorías sin cambios de código. Desactivar no
// toca las oportunidades existentes (CA2): solo deja de ofrecerse al publicar (getActiveCategory).
// Cada cambio queda en la auditoría en la misma transacción (HU-038 CA1).
@Injectable()
export class AdminCategoriesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT) private readonly audit: AuditContract,
  ) {}

  // Todas, también las inactivas, con cuántas oportunidades las usan.
  async list() {
    const rows = await this.prisma.category.findMany({
      select: { ...select, _count: { select: { opportunities: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return rows.map(({ _count, ...category }) => ({
      ...category,
      opportunities: _count.opportunities,
    }));
  }

  async create(dto: CreateCategoryDto, actor: Actor) {
    try {
      return await serializableTransaction(this.prisma, async (tx) => {
        await this.assertNameFree(tx, dto.name);
        const category = await tx.category.create({
          data: { name: dto.name, description: dto.description ?? null },
          select,
        });
        await this.audit.record(
          {
            actorUserId: actor.userId,
            action: 'CATEGORY_CREATED',
            targetType: 'category',
            targetId: String(category.id),
            ip: actor.ip,
            data: { name: category.name },
          },
          tx,
        );
        return category;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) throw new ConflictException(CATEGORY_EXISTS);
      throw error;
    }
  }

  async update(id: number, dto: UpdateCategoryDto, actor: Actor) {
    try {
      return await serializableTransaction(this.prisma, async (tx) => {
        const current = await tx.category.findUnique({ where: { id }, select });
        if (!current) throw new NotFoundException();
        if (dto.name !== undefined && dto.name !== current.name) {
          await this.assertNameFree(tx, dto.name, id);
        }
        const data: Prisma.CategoryUpdateInput = {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        };
        const category = await tx.category.update({ where: { id }, data, select });
        const changed = (['name', 'description', 'isActive'] as const).filter(
          (field) => category[field] !== current[field],
        );
        if (changed.length > 0) {
          await this.audit.record(
            {
              actorUserId: actor.userId,
              action: 'CATEGORY_UPDATED',
              targetType: 'category',
              targetId: String(id),
              ip: actor.ip,
              data: {
                changed: changed.join(','),
                name: category.name,
                ...(changed.includes('name') && { previousName: current.name }),
                ...(changed.includes('isActive') && { isActive: category.isActive }),
              },
            },
            tx,
          );
        }
        return category;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) throw new ConflictException(CATEGORY_EXISTS);
      throw error;
    }
  }

  // El índice único distingue mayúsculas; aquí se evita "Plomería" junto a "plomería".
  private async assertNameFree(tx: Prisma.TransactionClient, name: string, exceptId?: number) {
    const clash = await tx.category.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId !== undefined && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (clash) throw new ConflictException(CATEGORY_EXISTS);
  }
}
