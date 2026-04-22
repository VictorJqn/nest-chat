import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AppEvents } from '../events/events.service';
import { UsersService } from './users.service';

type CreateUserBody = {
  email?: string;
  name?: string;
  password?: string;
};

type UpdateUserBody = {
  name?: string | null;
  color?: string;
};

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly appEvents: AppEvents,
  ) {}

  @Get()
  getUsers() {
    return this.usersService.getUsers();
  }

  @Post()
  createUser(@Body() body: CreateUserBody) {
    const email = body.email?.trim();
    const name = body.name?.trim();
    const password = body.password?.trim();

    if (!email) {
      throw new BadRequestException('email is required');
    }

    if (!password || password.length < 6) {
      throw new BadRequestException('password min 6 chars');
    }

    return this.usersService.registerUser(email, name || undefined, password);
  }

  @Patch(':id')
  async updateUser(@Param('id') userId: string, @Body() body: UpdateUserBody) {
    if (!userId) {
      throw new BadRequestException('id is required');
    }

    const userMaj = await this.usersService.updateProfile(userId, {
      name: body.name,
      color: body.color,
    });

    if (userMaj) {
      this.appEvents.pushUserUpdated({
        id: userMaj.id,
        email: userMaj.email,
        name: userMaj.name,
        color: userMaj.color,
      });
    }

    return userMaj;
  }
}
