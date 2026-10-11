import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../database/prisma.service';

export type PrismaMock = DeepMockProxy<PrismaClient>;

/** Interaktif transaction callback'lerini aynı mock üzerinde çalıştıran Prisma mock'u. */
export function createPrismaMock(): PrismaMock {
  const prisma = mockDeep<PrismaClient>();
  prisma.$transaction.mockImplementation(((arg: unknown) =>
    typeof arg === 'function' ? arg(prisma) : Promise.all(arg as Promise<unknown>[])) as never);
  return prisma;
}

export const asPrismaService = (mock: PrismaMock) => mock as unknown as PrismaService;
