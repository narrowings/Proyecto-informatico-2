import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { CatalogsService } from './catalogs.service';

const setup = () => {
  const prisma = {
    zone: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn() },
    category: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma, catalogs: new CatalogsService(prisma as unknown as PrismaService) };
};

describe('CatalogsService (T-03)', () => {
  it('lista solo zonas activas, ordenadas por nombre (RF-02-08)', async () => {
    const { prisma, catalogs } = setup();
    await catalogs.listZones();
    expect(prisma.zone.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  });

  it('lista solo categorías activas con su descripción (RF-03-13)', async () => {
    const { prisma, catalogs } = setup();
    await catalogs.listCategories();
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  });

  it('una zona inactiva o inexistente no es válida', async () => {
    const { prisma, catalogs } = setup();
    prisma.zone.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    expect(await catalogs.isActiveZone(1)).toBe(true);
    expect(await catalogs.isActiveZone(99)).toBe(false);
    expect(prisma.zone.count).toHaveBeenLastCalledWith({ where: { id: 99, isActive: true } });
  });

  it('devuelve las categorías inexistentes o inactivas, sin repetir', async () => {
    const { prisma, catalogs } = setup();
    prisma.category.findMany.mockResolvedValue([{ id: 1 }, { id: 3 }]);
    expect(await catalogs.findInvalidCategoryIds([1, 2, 2, 3, 7])).toEqual([2, 7]);
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2, 3, 7] }, isActive: true },
      select: { id: true },
    });
  });

  it('todas válidas: lista vacía', async () => {
    const { prisma, catalogs } = setup();
    prisma.category.findMany.mockResolvedValue([{ id: 4 }]);
    expect(await catalogs.findInvalidCategoryIds([4])).toEqual([]);
  });
});
