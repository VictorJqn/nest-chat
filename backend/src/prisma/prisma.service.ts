import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    // Adrien: connexion Prisma au demarrage de Nest
    await this.$connect();
  }

  async onModuleDestroy() {
    // Adrien: propre quand on coupe le serveur
    await this.$disconnect();
  }
}
