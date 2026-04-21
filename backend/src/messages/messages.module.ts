import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [UsersModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
