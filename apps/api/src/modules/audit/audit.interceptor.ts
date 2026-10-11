import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { from, Observable, switchMap, tap } from 'rxjs';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AUDITABLE_KEY } from './auditable.decorator';
import { AuditService } from './audit.service';

const ACTIONS: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

type Delegate = { findUnique: (args: { where: { id: string } }) => Promise<unknown> };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const model = this.reflector.getAllAndOverride<Prisma.ModelName | undefined>(AUDITABLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const method = ACTIONS[request.method];

    if (!model || !method) return next.handle();

    const rawId = request.params?.id;
    const entityId = typeof rawId === 'string' ? rawId : undefined;
    const action = this.resolveAction(request, method);

    return from(this.loadBefore(model, entityId)).pipe(
      switchMap((before) =>
        next.handle().pipe(
          tap((result) => {
            void this.audit.log({
              userId: request.user?.id,
              action,
              entity: model,
              entityId: entityId ?? (result as { id?: string } | undefined)?.id,
              before,
              after: method === 'DELETE' ? undefined : result,
              ip: request.ip,
            });
          }),
        ),
      ),
    );
  }

  /** `/purchase-orders/:id/receive` gibi rotalarda aksiyonu RECEIVE olarak adlandırır. */
  private resolveAction(request: Request, fallback: string): string {
    const routePath: string = request.route?.path ?? '';
    const match = routePath.match(/:id\/([a-z-]+)$/);
    return match ? match[1].toUpperCase().replace(/-/g, '_') : fallback;
  }

  private async loadBefore(model: Prisma.ModelName, id?: string): Promise<unknown> {
    if (!id) return undefined;
    const key = (model.charAt(0).toLowerCase() + model.slice(1)) as keyof PrismaService;
    const delegate = this.prisma[key] as unknown as Delegate | undefined;
    return delegate?.findUnique ? delegate.findUnique({ where: { id } }) : undefined;
  }
}
