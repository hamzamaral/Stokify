import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
  requestId?: string;
}

const PRISMA_ERROR_MAP: Record<string, { status: HttpStatus; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'Bu değere sahip bir kayıt zaten mevcut' },
  P2003: { status: HttpStatus.CONFLICT, message: 'İlişkili kayıtlar nedeniyle işlem yapılamıyor' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Kayıt bulunamadı' },
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { id?: string }>();
    const response = ctx.getResponse<Response>();

    const { status, message, details } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const body: ErrorResponse = {
      statusCode: status,
      error: HttpStatus[status] ?? 'ERROR',
      message,
      ...(details !== undefined && { details }),
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.id,
    };

    response.status(status).json(body);
  }

  private resolve(exception: unknown): { status: number; message: string; details?: unknown } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') return { status: exception.getStatus(), message: res };
      const { message } = res as { message?: string | string[] };
      if (Array.isArray(message)) {
        return { status: exception.getStatus(), message: 'Doğrulama hatası', details: message };
      }
      return { status: exception.getStatus(), message: message ?? exception.message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_ERROR_MAP[exception.code];
      if (mapped) {
        return { status: mapped.status, message: mapped.message, details: exception.meta };
      }
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Beklenmeyen bir hata oluştu' };
  }
}
