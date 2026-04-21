import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';

type CreateUserBody = {
  email?: string;
  name?: string;
  password?: string;
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getUsers() {
    return this.usersService.getUsers();
  }

  @Post()
  createUser(@Body() body: CreateUserBody) {
    const email = body.email?.trim();
    const name = body.name?.trim();
    const password = body.password?.trim();

    // Adrien: je garde une validation basique ici
    if (!email) {
      throw new BadRequestException('email is required');
    }

    if (!password || password.length < 6) {
      throw new BadRequestException('password min 6 chars');
    }

    return this.usersService.registerUser(email, name || undefined, password);
  }
}
