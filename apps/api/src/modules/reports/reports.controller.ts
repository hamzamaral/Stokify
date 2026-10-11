import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

class DashboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(365)
  days?: number;
}

class DateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard KPI ve grafik verileri' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  dashboard(@Query() query: DashboardQueryDto) {
    return this.reportsService.dashboard(query.days ?? 30);
  }

  @Get('critical-stock')
  @ApiOperation({ summary: 'Minimum stok seviyesinin altındaki ürünler' })
  criticalStock() {
    return this.reportsService.criticalProducts(100);
  }

  @Roles(Role.MANAGER)
  @Get('export/products')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="urunler.csv"')
  exportProducts() {
    return this.reportsService.exportProductsCsv();
  }

  @Roles(Role.MANAGER)
  @Get('export/movements')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="stok-hareketleri.csv"')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  exportMovements(@Query() query: DateRangeQueryDto) {
    return this.reportsService.exportMovementsCsv(query.from, query.to);
  }
}
