import { Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AppEvents } from '../events/events.service';
import { MessagesService } from '../messages/messages.service';
import { RoomsService } from '../rooms/rooms.service';
import { UsersService } from '../users/users.service';

type JoinGeneralBody = {
  userId?: string;
};

type SendGeneralBody = {
  content?: string;
  userId?: string;
};

type ReactionBody = {
  messageId?: string;
  emoji?: string;
};

type RoomJoinBody = {
  roomId?: string;
  userId?: string;
};

type RoomSendBody = {
  roomId?: string;
  content?: string;
};

type RoomTypingBody = {
  roomId?: string;
};

type RoomReactionBody = {
  roomId?: string;
  messageId?: string;
  emoji?: string;
};

function roomChannel(roomId: string) {
  return `room:${roomId}`;
}

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly messagesService: MessagesService,
    private readonly roomsService: RoomsService,
    private readonly appEvents: AppEvents,
  ) {}

  onModuleInit() {
    this.appEvents.onUserUpdated((u) => {
      this.server.emit('user:updated', u);
      this.server.to('general').emit('general:user_updated', u);
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`socket connected ${client.id}`);
    client.data.typingRooms = new Set<string>();
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`socket disconnected ${client.id}`);

    if (typeof client.data.userId !== 'string') {
      return;
    }

    if (client.data.isTyping) {
      client.to('general').emit('general:typing_stop', {
        userId: client.data.userId,
      });
    }

    const typingRooms: Set<string> = client.data.typingRooms ?? new Set();

    for (const rid of typingRooms) {
      client.to(roomChannel(rid)).emit('room:typing_stop', {
        roomId: rid,
        userId: client.data.userId,
      });
    }

    this.server.to('general').emit('general:user_left', {
      userId: client.data.userId,
      name: client.data.userName || 'unknown',
    });
  }

  @SubscribeMessage('general:join')
  async joinGeneral(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinGeneralBody,
  ) {
    try {
      const userId = body.userId?.trim();

      if (!userId) {
        throw new WsException('userId is required');
      }

      const user = await this.usersService.findPublicById(userId);

      if (!user) {
        throw new WsException('user introuvable');
      }

      client.data.userId = user.id;
      client.data.userName = user.name || user.email;
      await client.join('general');

      const oldMsgs = await this.messagesService.getGeneralMessages(30);

      client.emit('general:init', oldMsgs);

      this.server.to('general').emit('general:user_joined', {
        userId: user.id,
        name: user.name || user.email,
      });

      return { ok: true, room: 'general', user };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('general:send')
  async sendGeneralMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SendGeneralBody,
  ) {
    try {
      const content = body.content?.trim();

      if (!content) {
        throw new WsException('content is required');
      }

      const socketUserId =
        typeof client.data.userId === 'string' ? client.data.userId : '';
      const bodyUserId = body.userId?.trim() || '';
      const userId = socketUserId || bodyUserId;

      if (!userId) {
        throw new WsException('join general first');
      }

      const msgSaved = await this.messagesService.createMessage(userId, content);

      if (client.data.isTyping) {
        client.data.isTyping = false;
        client.to('general').emit('general:typing_stop', { userId });
      }

      this.server.to('general').emit('general:new_message', msgSaved);

      return { ok: true, messageId: msgSaved.id };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('general:typing_start')
  onTypingStart(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    if (typeof userId !== 'string') {
      return;
    }

    if (client.data.isTyping) {
      return;
    }

    client.data.isTyping = true;

    client.to('general').emit('general:typing_start', {
      userId,
      name: client.data.userName || 'unknown',
    });
  }

  @SubscribeMessage('general:typing_stop')
  onTypingStop(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    if (typeof userId !== 'string') {
      return;
    }

    if (!client.data.isTyping) {
      return;
    }

    client.data.isTyping = false;
    client.to('general').emit('general:typing_stop', { userId });
  }

  @SubscribeMessage('general:reaction_add')
  async onReactionAdd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ReactionBody,
  ) {
    try {
      const userId = client.data.userId;

      if (typeof userId !== 'string') {
        throw new WsException('join general first');
      }

      const messageId = body.messageId?.trim();
      const emoji = body.emoji?.trim();

      if (!messageId || !emoji) {
        throw new WsException('messageId et emoji requis');
      }

      const { reaction, alreadyThere } = await this.messagesService.addReaction(
        messageId,
        userId,
        emoji,
      );

      if (alreadyThere) {
        return { ok: true, already: true };
      }

      this.server.to('general').emit('general:reaction_added', {
        messageId,
        reaction,
      });

      return { ok: true };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('general:reaction_remove')
  async onReactionRemove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ReactionBody,
  ) {
    try {
      const userId = client.data.userId;

      if (typeof userId !== 'string') {
        throw new WsException('join general first');
      }

      const messageId = body.messageId?.trim();
      const emoji = body.emoji?.trim();

      if (!messageId || !emoji) {
        throw new WsException('messageId et emoji requis');
      }

      const { removed, reactionId } = await this.messagesService.removeReaction(
        messageId,
        userId,
        emoji,
      );

      if (!removed) {
        return { ok: true, missing: true };
      }

      this.server.to('general').emit('general:reaction_removed', {
        messageId,
        reactionId,
        userId,
        emoji,
      });

      return { ok: true };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('room:join')
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomJoinBody,
  ) {
    try {
      const roomId = body.roomId?.trim();
      const bodyUserId = body.userId?.trim() || '';
      const socketUserId =
        typeof client.data.userId === 'string' ? client.data.userId : '';
      const userId = socketUserId || bodyUserId;

      if (!roomId || !userId) {
        throw new WsException('roomId et userId requis');
      }

      const { room, me } = await this.roomsService.getRoomForUser(roomId, userId);

      if (!socketUserId) {
        const user = await this.usersService.findPublicById(userId);

        if (!user) {
          throw new WsException('user introuvable');
        }

        client.data.userId = user.id;
        client.data.userName = user.name || user.email;
      }

      await client.join(roomChannel(room.id));

      const history = await this.messagesService.getRoomMessages({
        roomId: room.id,
        canSeeHistory: me.canSeeHistory,
        memberJoinedAt: me.joinedAt,
      });

      client.emit('room:init', { roomId: room.id, messages: history });

      return { ok: true, roomId: room.id };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('room:send')
  async sendRoomMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomSendBody,
  ) {
    try {
      const roomId = body.roomId?.trim();
      const content = body.content?.trim();
      const userId =
        typeof client.data.userId === 'string' ? client.data.userId : '';

      if (!userId) {
        throw new WsException('join une room avant');
      }

      if (!roomId || !content) {
        throw new WsException('roomId et content requis');
      }

      await this.roomsService.getRoomForUser(roomId, userId);

      const msgSaved = await this.messagesService.createMessage(
        userId,
        content,
        roomId,
      );

      const typingRooms: Set<string> = client.data.typingRooms ?? new Set();

      if (typingRooms.has(roomId)) {
        typingRooms.delete(roomId);
        client.to(roomChannel(roomId)).emit('room:typing_stop', {
          roomId,
          userId,
        });
      }

      this.server
        .to(roomChannel(roomId))
        .emit('room:new_message', { roomId, message: msgSaved });

      return { ok: true, messageId: msgSaved.id };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('room:typing_start')
  async onRoomTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomTypingBody,
  ) {
    const userId =
      typeof client.data.userId === 'string' ? client.data.userId : '';
    const roomId = body.roomId?.trim();

    if (!userId || !roomId) {
      return;
    }

    const typingRooms: Set<string> = client.data.typingRooms ?? new Set();
    client.data.typingRooms = typingRooms;

    if (typingRooms.has(roomId)) {
      return;
    }

    typingRooms.add(roomId);

    client.to(roomChannel(roomId)).emit('room:typing_start', {
      roomId,
      userId,
      name: client.data.userName || 'unknown',
    });
  }

  @SubscribeMessage('room:typing_stop')
  async onRoomTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomTypingBody,
  ) {
    const userId =
      typeof client.data.userId === 'string' ? client.data.userId : '';
    const roomId = body.roomId?.trim();

    if (!userId || !roomId) {
      return;
    }

    const typingRooms: Set<string> = client.data.typingRooms ?? new Set();

    if (!typingRooms.has(roomId)) {
      return;
    }

    typingRooms.delete(roomId);

    client.to(roomChannel(roomId)).emit('room:typing_stop', {
      roomId,
      userId,
    });
  }

  @SubscribeMessage('room:reaction_add')
  async onRoomReactionAdd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomReactionBody,
  ) {
    try {
      const userId =
        typeof client.data.userId === 'string' ? client.data.userId : '';
      const roomId = body.roomId?.trim();
      const messageId = body.messageId?.trim();
      const emoji = body.emoji?.trim();

      if (!userId || !roomId || !messageId || !emoji) {
        throw new WsException('données manquantes');
      }

      await this.roomsService.getRoomForUser(roomId, userId);

      const { reaction, alreadyThere } = await this.messagesService.addReaction(
        messageId,
        userId,
        emoji,
      );

      if (alreadyThere) {
        return { ok: true, already: true };
      }

      this.server.to(roomChannel(roomId)).emit('room:reaction_added', {
        roomId,
        messageId,
        reaction,
      });

      return { ok: true };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('room:reaction_remove')
  async onRoomReactionRemove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomReactionBody,
  ) {
    try {
      const userId =
        typeof client.data.userId === 'string' ? client.data.userId : '';
      const roomId = body.roomId?.trim();
      const messageId = body.messageId?.trim();
      const emoji = body.emoji?.trim();

      if (!userId || !roomId || !messageId || !emoji) {
        throw new WsException('données manquantes');
      }

      await this.roomsService.getRoomForUser(roomId, userId);

      const { removed, reactionId } = await this.messagesService.removeReaction(
        messageId,
        userId,
        emoji,
      );

      if (!removed) {
        return { ok: true, missing: true };
      }

      this.server.to(roomChannel(roomId)).emit('room:reaction_removed', {
        roomId,
        messageId,
        reactionId,
        userId,
        emoji,
      });

      return { ok: true };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  private toWsError(error: unknown) {
    if (error instanceof WsException) {
      return error;
    }

    if (error instanceof Error) {
      return new WsException(error.message);
    }

    return new WsException('internal server error');
  }
}
