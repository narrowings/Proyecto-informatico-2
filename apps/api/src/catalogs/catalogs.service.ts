import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const byName = { name: 'asc' } as const;

// Catálogos de zonas de Cali y categorías (T-03). Este módulo es el dueño de las tablas `zones` y
// `categories`: perfiles y oportunidades validan contra estos métodos en vez de leerlas directo.
@Injectable()
export class CatalogsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // RF-02-08: la ubicación se elige de un catálogo cerrado de zonas o barrios de Cali.
  listZones() {
    return this.prisma.zone.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: byName,
    });
  }

  // RF-03-13 y HU-037: solo se ofrecen las categorías activas.
  listCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true },
      orderBy: byName,
    });
  }

  async isActiveZone(id: number) {
    return (await this.prisma.zone.count({ where: { id, isActive: true } })) === 1;
  }

  // Devuelve los ids que no existen o están inactivos; vacío si todos son válidos.
  async findInvalidCategoryIds(ids: number[]) {
    const unique = [...new Set(ids)];
    const active = await this.prisma.category.findMany({
      where: { id: { in: unique }, isActive: true },
      select: { id: true },
    });
    const valid = new Set(active.map((category) => category.id));
    return unique.filter((id) => !valid.has(id));
  }
}
