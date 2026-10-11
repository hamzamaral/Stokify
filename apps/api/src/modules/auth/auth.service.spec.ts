import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { EnvConfig } from '../../config/env.validation';
import { asPrismaService, createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';

const config = {
  get: (key: string) =>
    ({ JWT_REFRESH_SECRET: 'x'.repeat(32), JWT_REFRESH_TTL_DAYS: 7, JWT_ACCESS_TTL: '15m' })[key],
} as unknown as ConfigService<EnvConfig, true>;

const user = {
  id: 'u1',
  email: 'admin@stokify.com',
  role: Role.ADMIN,
  isActive: true,
  passwordHash: bcrypt.hashSync('Admin123!', 4),
};

describe('AuthService', () => {
  let prisma: PrismaMock;
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') } as unknown as JwtService;
    const audit = { log: jest.fn() } as unknown as AuditService;
    service = new AuthService(asPrismaService(prisma), jwt, config, audit);
  });

  describe('login', () => {
    it('doğru bilgilerle token çifti döner ve şifre hash’ini sızdırmaz', async () => {
      prisma.user.findUnique.mockResolvedValue(user as never);
      const result = await service.login('ADMIN@stokify.com', 'Admin123!');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toHaveLength(64);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('yanlış şifrede yetkisiz hatası verir', async () => {
      prisma.user.findUnique.mockResolvedValue(user as never);
      await expect(service.login(user.email, 'yanlis')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('pasif kullanıcı giriş yapamaz', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, isActive: false } as never);
      await expect(service.login(user.email, 'Admin123!')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('geçerli token’ı iptal edip yenisini verir (rotation)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user,
      } as never);

      const tokens = await service.refresh('old-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(tokens.refreshToken).not.toBe('old-token');
    });

    it('iptal edilmiş token tekrar kullanılırsa kullanıcının tüm oturumlarını kapatır', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        user,
      } as never);

      await expect(service.refresh('stolen')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
