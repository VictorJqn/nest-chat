import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [UsersModule, MessagesModule],
  providers: [ChatGateway],
})
export class ChatModule {}
