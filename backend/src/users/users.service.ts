import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  readonly userSafeSelect = {
    id: true,
    email: true,
    name: true,
    color: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  getUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: this.userSafeSelect,
    });
  }

  findPublicById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userSafeSelect,
    });
  }

  findByEmailForAuth(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        color: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: true,
      },
    });
  }

  createWithPasswordHash(
    email: string,
    name: string | undefined,
    passwordHash: string,
  ) {
    return this.prisma.user.create({
      data: { email, name, passwordHash },
      select: this.userSafeSelect,
    });
  }

  setPasswordForExistingUser(
    userId: string,
    name: string | undefined,
    passwordHash: string,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, name },
      select: this.userSafeSelect,
    });
  }

  toPublicUser(user: {
    id: string;
    email: string;
    name: string | null;
    color: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      color: user.color,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateProfile(
    userId: string,
    data: { name?: string | null; color?: string },
  ) {
    const usr = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!usr) {
      throw new NotFoundException('user introuvable');
    }

    const dataMaj: { name?: string | null; color?: string } = {};

    if (data.name !== undefined) {
      const n = data.name?.trim();

      if (!n) {
        dataMaj.name = null;
      } else {
        if (n.length > 40) {
          throw new BadRequestException('username trop long (max 40)');
        }
        dataMaj.name = n;
      }
    }

    if (data.color !== undefined) {
      const c = data.color.trim().toLowerCase();

      if (!/^#[0-9a-f]{6}$/.test(c)) {
        throw new BadRequestException('color doit etre en #rrggbb');
      }

      dataMaj.color = c;
    }

    if (!Object.keys(dataMaj).length) {
      return this.findPublicById(userId);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dataMaj,
      select: this.userSafeSelect,
    });
  }

  async registerUser(email: string, name: string | undefined, password: string) {
    const emailClean = email.toLowerCase();

    // Adrien: je check avant pour eviter une erreur SQL pas claire
    const userExist = await this.findByEmailForAuth(emailClean);
    const passwordHash = this.hashPass(password);

    if (userExist) {
      // Adrien: utile si un ancien user existe sans mot de passe (avant la feature auth)
      if (!userExist.passwordHash) {
        return this.setPasswordForExistingUser(userExist.id, name, passwordHash);
      }

      throw new BadRequestException('email deja pris');
    }

    return this.createWithPasswordHash(emailClean, name, passwordHash);
  }

  private hashPass(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }
}
