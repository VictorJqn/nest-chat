import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private get memberInclude() {
    return {
      user: { select: this.usersService.userSafeSelect },
    };
  }

  private get roomInclude() {
    return {
      owner: { select: this.usersService.userSafeSelect },
      members: { include: this.memberInclude },
    };
  }

  async createRoom(data: {
    name: string;
    ownerId: string;
    memberIds?: string[];
    canSeeHistory?: boolean;
  }) {
    const nameClean = data.name?.trim();

    if (!nameClean) {
      throw new BadRequestException('nom du salon requis');
    }

    if (nameClean.length > 60) {
      throw new BadRequestException('nom trop long (max 60)');
    }

    const owner = await this.usersService.findPublicById(data.ownerId);

    if (!owner) {
      throw new NotFoundException('owner introuvable');
    }

    const extraIds = (data.memberIds ?? [])
      .map((x) => x.trim())
      .filter((x) => x && x !== owner.id);

    const uniqueExtra = [...new Set(extraIds)];

    if (uniqueExtra.length > 0) {
      const found = await this.prisma.user.findMany({
        where: { id: { in: uniqueExtra } },
        select: { id: true },
      });

      if (found.length !== uniqueExtra.length) {
        throw new BadRequestException('un des membres invités est introuvable');
      }
    }

    const canSeeHist = data.canSeeHistory === true;

    const room = await this.prisma.room.create({
      data: {
        name: nameClean,
        ownerId: owner.id,
        members: {
          create: [
            { userId: owner.id, canSeeHistory: true },
            ...uniqueExtra.map((uid) => ({
              userId: uid,
              canSeeHistory: canSeeHist,
            })),
          ],
        },
      },
      include: this.roomInclude,
    });

    return room;
  }

  async listRoomsForUser(userId: string) {
    if (!userId) {
      throw new BadRequestException('userId requis');
    }

    const rooms = await this.prisma.room.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
      include: this.roomInclude,
    });

    return rooms;
  }

  async getRoomForUser(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: this.roomInclude,
    });

    if (!room) {
      throw new NotFoundException('salon introuvable');
    }

    const mine = room.members.find((m) => m.userId === userId);

    if (!mine) {
      throw new ForbiddenException('tu ne fais pas partie de ce salon');
    }

    return { room, me: mine };
  }

  async addMember(
    roomId: string,
    inviterId: string,
    data: { userId: string; canSeeHistory?: boolean },
  ) {
    const newUserId = data.userId?.trim();

    if (!newUserId) {
      throw new BadRequestException('userId requis');
    }

    const { room } = await this.getRoomForUser(roomId, inviterId);

    if (room.ownerId !== inviterId) {
      throw new ForbiddenException('seul le créateur peut inviter');
    }

    const already = room.members.some((m) => m.userId === newUserId);

    if (already) {
      throw new BadRequestException('user déjà dans le salon');
    }

    const exists = await this.usersService.findPublicById(newUserId);

    if (!exists) {
      throw new NotFoundException('user introuvable');
    }

    await this.prisma.roomMember.create({
      data: {
        roomId,
        userId: newUserId,
        canSeeHistory: data.canSeeHistory === true,
      },
    });

    return this.prisma.room.findUnique({
      where: { id: roomId },
      include: this.roomInclude,
    });
  }
}
