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
    private readonly appEvents: AppEvents,
  ) {}

  onModuleInit() {
    this.appEvents.onUserUpdated((u) => {
      this.server.to('general').emit('general:user_updated', u);
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`socket connected ${client.id}`);
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

      // Adrien: on push l'historique direct quand le user rejoint
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
