import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Prisma conecta de forma diferida en la primera consulta, así la api arranca
// aunque la base de datos aún no esté lista y /v1/health lo reporta.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
