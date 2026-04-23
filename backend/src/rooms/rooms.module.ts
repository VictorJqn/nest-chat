import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [UsersModule, MessagesModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
