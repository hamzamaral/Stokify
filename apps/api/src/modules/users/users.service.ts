import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { paginate, resolveSort } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './dto/user.dto';
import { toPublicUser } from './users.mapper';

const SORTABLE = ['fullName', 'email', 'role', 'createdAt', 'lastLoginAt'] as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: UserQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.role && { role: query.role }),
      ...(query.search && {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(users.map(toPublicUser), total, query);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    return toPublicUser(user);
  }

  async create(dto: CreateUserDto) {
    const { password, ...data } = dto;
    const user = await this.prisma.user.create({
      data: { ...data, passwordHash: await bcrypt.hash(password, 10) },
    });
    return toPublicUser(user);
  }

  async update(id: string, dto: UpdateUserDto, currentUserId: string) {
    await this.findOne(id);
    if (id === currentUserId && (dto.isActive === false || (dto.role && dto.role !== 'ADMIN'))) {
      throw new BadRequestException(
        'Kendi hesabınızı pasifleştiremez veya rolünüzü düşüremezsiniz',
      );
    }
    const { password, ...data } = dto;
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...data, ...(password && { passwordHash: await bcrypt.hash(password, 10) }) },
    });
    if (dto.isActive === false || password) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return toPublicUser(user);
  }

  /** Kullanıcılar hareket geçmişine bağlı olduğu için silinmez, pasifleştirilir. */
  async deactivate(id: string, currentUserId: string) {
    return this.update(id, { isActive: false }, currentUserId);
  }
}
