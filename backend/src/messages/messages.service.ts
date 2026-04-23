import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private get msgInclude() {
    return {
      user: { select: this.usersService.userSafeSelect },
      reactions: {
        orderBy: { createdAt: 'asc' as const },
        include: { user: { select: this.usersService.userSafeSelect } },
      },
    };
  }

  getMessages() {
    return this.prisma.message.findMany({
      include: this.msgInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMessage(userId: string, content: string, roomId: string | null = null) {
    const usr = await this.usersService.findPublicById(userId);

    if (!usr) {
      throw new NotFoundException('user introuvable');
    }

    const messageTxt = content.trim();

    return this.prisma.message.create({
      data: { userId: usr.id, content: messageTxt, roomId: roomId ?? null },
      include: this.msgInclude,
    });
  }

  async getGeneralMessages(limit = 30) {
    const msgs = await this.prisma.message.findMany({
      where: { roomId: null },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: this.msgInclude,
    });

    return msgs.reverse();
  }

  async getRoomMessages(params: {
    roomId: string;
    canSeeHistory: boolean;
    memberJoinedAt: Date;
    limit?: number;
  }) {
    const take = params.limit ?? 50;

    const where = params.canSeeHistory
      ? { roomId: params.roomId }
      : { roomId: params.roomId, createdAt: { gte: params.memberJoinedAt } };

    const msgs = await this.prisma.message.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      include: this.msgInclude,
    });

    return msgs.reverse();
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    const emojiClean = emoji.trim();

    if (!emojiClean || emojiClean.length > 20) {
      throw new BadRequestException('emoji invalide');
    }

    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });

    if (!msg) {
      throw new NotFoundException('message introuvable');
    }

    const usr = await this.usersService.findPublicById(userId);

    if (!usr) {
      throw new NotFoundException('user introuvable');
    }

    const existing = await this.prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji: emojiClean,
        },
      },
    });

    if (existing) {
      return { reaction: existing, alreadyThere: true };
    }

    const reaction = await this.prisma.reaction.create({
      data: { messageId, userId, emoji: emojiClean },
      include: { user: { select: this.usersService.userSafeSelect } },
    });

    return { reaction, alreadyThere: false };
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    const emojiClean = emoji.trim();

    if (!emojiClean) {
      throw new BadRequestException('emoji invalide');
    }

    const existing = await this.prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji: emojiClean,
        },
      },
    });

    if (!existing) {
      return { removed: false, reactionId: null };
    }

    await this.prisma.reaction.delete({ where: { id: existing.id } });

    return { removed: true, reactionId: existing.id };
  }
}
