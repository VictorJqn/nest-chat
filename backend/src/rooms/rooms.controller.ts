import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { RoomsService } from './rooms.service';

type CreateRoomBody = {
  name?: string;
  ownerId?: string;
  memberIds?: string[];
  canSeeHistory?: boolean;
};

type AddMemberBody = {
  userId?: string;
  inviterUserId?: string;
  canSeeHistory?: boolean;
};

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly messagesService: MessagesService,
  ) {}

  @Post()
  createRoom(@Body() body: CreateRoomBody) {
    if (!body.ownerId) {
      throw new BadRequestException('ownerId requis');
    }

    return this.roomsService.createRoom({
      name: body.name ?? '',
      ownerId: body.ownerId,
      memberIds: body.memberIds,
      canSeeHistory: body.canSeeHistory,
    });
  }

  @Get()
  listRooms(@Query('userId') userId: string) {
    return this.roomsService.listRoomsForUser(userId);
  }

  @Get(':id')
  async getRoom(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId requis');
    }

    const { room } = await this.roomsService.getRoomForUser(id, userId);
    return room;
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId requis');
    }

    const { room, me } = await this.roomsService.getRoomForUser(id, userId);

    return this.messagesService.getRoomMessages({
      roomId: room.id,
      canSeeHistory: me.canSeeHistory,
      memberJoinedAt: me.joinedAt,
    });
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: AddMemberBody) {
    if (!body.inviterUserId) {
      throw new BadRequestException('inviterUserId requis');
    }

    return this.roomsService.addMember(id, body.inviterUserId, {
      userId: body.userId ?? '',
      canSeeHistory: body.canSeeHistory,
    });
  }
}
