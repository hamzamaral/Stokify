import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../config/env.validation';
import { PrismaService } from '../prisma.service';
import { isDatabaseEmpty, runSeed } from './seeder';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('SEED_ON_EMPTY', { infer: true })) return;

    if (!(await isDatabaseEmpty(this.prisma))) {
      this.logger.log('Veritabanında veri mevcut, otomatik seed atlandı');
      return;
    }

    this.logger.log('Veritabanı boş, demo verileri yükleniyor...');
    await runSeed(this.prisma, this.logger);
  }
}
