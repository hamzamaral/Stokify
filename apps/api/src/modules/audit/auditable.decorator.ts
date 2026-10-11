import { SetMetadata } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const AUDITABLE_KEY = 'auditable';

/** Prisma model adı (örn. "Product"). Mutasyon endpointleri otomatik olarak audit loga yazılır. */
export const Auditable = (model: Prisma.ModelName) => SetMetadata(AUDITABLE_KEY, model);
