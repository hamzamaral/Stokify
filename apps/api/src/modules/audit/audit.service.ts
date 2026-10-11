import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';

const SENSITIVE_FIELDS = ['passwordHash', 'password', 'tokenHash', 'refreshToken', 'accessToken'];

export interface AuditEntry {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          ...entry,
          before: this.sanitize(entry.before),
          after: this.sanitize(entry.after),
        },
      });
    } catch (error) {
      // Audit yazılamaması asıl işlemi bozmamalı
      this.logger.warn(`Audit log yazılamadı: ${(error as Error).message}`);
    }
  }

  async findAll(query: AuditQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entity && { entity: query.entity }),
      ...(query.entityId && { entityId: query.entityId }),
      ...(query.userId && { userId: query.userId }),
      ...(query.action && { action: query.action }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  private sanitize(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === undefined || value === null) return Prisma.JsonNull;
    return JSON.parse(
      JSON.stringify(value, (k, v) => (SENSITIVE_FIELDS.includes(k) ? undefined : v)),
    );
  }
}
