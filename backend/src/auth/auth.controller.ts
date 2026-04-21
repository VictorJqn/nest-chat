import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

type RegisterBody = {
  email?: string;
  name?: string;
  password?: string;
};

type LoginBody = {
  email?: string;
  password?: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterBody) {
    const email = body.email?.trim();
    const name = body.name?.trim();
    const password = body.password?.trim();

    if (!email) {
      throw new BadRequestException('email is required');
    }

    // Adrien: check mini pour eviter les mots de passe trop courts
    if (!password || password.length < 6) {
      throw new BadRequestException('password min 6 chars');
    }

    return this.authService.register(email, name || undefined, password);
  }

  @Post('login')
  login(@Body() body: LoginBody) {
    const email = body.email?.trim();
    const password = body.password?.trim();

    if (!email) {
      throw new BadRequestException('email is required');
    }

    if (!password) {
      throw new BadRequestException('password is required');
    }

    return this.authService.login(email, password);
  }
}
