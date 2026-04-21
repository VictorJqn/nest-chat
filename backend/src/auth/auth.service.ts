import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly authSecret = process.env.AUTH_SECRET || 'dev-secret-adrien';

  constructor(private readonly usersService: UsersService) {}

  register(email: string, name: string | undefined, password: string) {
    return this.usersService.registerUser(email, name, password);
  }

  async login(email: string, password: string) {
    const emailClean = email.toLowerCase();

    const user = await this.usersService.findByEmailForAuth(emailClean);

    // Adrien: meme message d'erreur pour pas leak si l'email existe
    if (!user) {
      throw new BadRequestException('email ou mot de passe invalide');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('email ou mot de passe invalide');
    }

    const isOk = this.checkPass(password, user.passwordHash);

    if (!isOk) {
      throw new BadRequestException('email ou mot de passe invalide');
    }

    const token = this.makeToken(user.id, user.email);

    return {
      token,
      user: this.usersService.toPublicUser(user),
    };
  }

  private checkPass(password: string, passStored: string) {
    const [salt, hashHex] = passStored.split(':');

    if (!salt || !hashHex) {
      return false;
    }

    const hashToCheck = scryptSync(password, salt, 64);
    const savedHash = Buffer.from(hashHex, 'hex');

    if (hashToCheck.length !== savedHash.length) {
      return false;
    }

    return timingSafeEqual(hashToCheck, savedHash);
  }

  private makeToken(userId: string, email: string) {
    const payload = {
      userId,
      email,
      exp: Date.now() + 1000 * 60 * 60 * 24,
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sign = createHmac('sha256', this.authSecret)
      .update(payloadB64)
      .digest('base64url');

    // Adrien: token maison simple pour le projet
    return `${payloadB64}.${sign}`;
  }
}
