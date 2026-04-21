import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  getMessages() {
    return this.prisma.message.findMany({
      include: {
        user: {
          select: this.usersService.userSafeSelect,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMessage(userId: string, content: string) {
    const usr = await this.usersService.findPublicById(userId);

    // Adrien: check simple pour eviter un 500 Prisma
    if (!usr) {
      throw new NotFoundException('user introuvable');
    }

    const messageTxt = content.trim();

    return this.prisma.message.create({
      data: { userId: usr.id, content: messageTxt },
      include: {
        user: {
          select: this.usersService.userSafeSelect,
        },
      },
    });
  }

  async getGeneralMessages(limit = 30) {
    const msgs = await this.prisma.message.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: this.usersService.userSafeSelect,
        },
      },
    });

    // Adrien: le front c'est plus simple quand c'est trie ancien -> recent
    return msgs.reverse();
  }
}
