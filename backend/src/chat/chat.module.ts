import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { RoomsModule } from '../rooms/rooms.module';
import { UsersModule } from '../users/users.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [UsersModule, MessagesModule, RoomsModule],
  providers: [ChatGateway],
})
export class ChatModule {}
