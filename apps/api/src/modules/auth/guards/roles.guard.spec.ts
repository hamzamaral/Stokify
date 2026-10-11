import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

const contextFor = (role?: Role) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role } : undefined }) }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  afterEach(() => jest.restoreAllMocks());

  it('rol gereksinimi yoksa izin verir', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextFor(Role.STAFF))).toBe(true);
  });

  it('gerekli role sahip kullanıcıya izin verir', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.MANAGER]);
    expect(guard.canActivate(contextFor(Role.MANAGER))).toBe(true);
  });

  it('ADMIN her zaman geçer', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.MANAGER]);
    expect(guard.canActivate(contextFor(Role.ADMIN))).toBe(true);
  });

  it('yetkisiz rolü reddeder', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.MANAGER]);
    expect(() => guard.canActivate(contextFor(Role.STAFF))).toThrow(ForbiddenException);
  });
});
