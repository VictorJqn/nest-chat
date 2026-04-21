import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { MessagesService } from './messages.service';

type CreateMessageBody = {
  userId?: string;
  content?: string;
};

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  getMessages() {
    return this.messagesService.getMessages();
  }

  @Post()
  createMessage(@Body() body: CreateMessageBody) {
    const userId = body.userId?.trim();
    const contentTxt = body.content?.trim();

    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    // Adrien: sans texte ca sert a rien d'enregistrer le message
    if (!contentTxt) {
      throw new BadRequestException('content is required');
    }

    return this.messagesService.createMessage(userId, contentTxt);
  }
}
