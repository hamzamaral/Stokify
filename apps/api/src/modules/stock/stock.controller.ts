import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Auditable } from '../audit/auditable.decorator';
import {
  MovementQueryDto,
  StockAdjustDto,
  StockInDto,
  StockOutDto,
  StockTransferDto,
} from './dto/stock.dto';
import { StockService } from './stock.service';

@ApiTags('Stock')
@ApiBearerAuth()
@Auditable('StockMovement')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('movements')
  @ApiOperation({ summary: 'Stok hareketlerini listele' })
  findMovements(@Query() query: MovementQueryDto) {
    return this.stockService.findMovements(query);
  }

  @Post('in')
  @ApiOperation({ summary: 'Stok girişi' })
  stockIn(@Body() dto: StockInDto, @CurrentUser('id') userId: string) {
    return this.stockService.stockIn(dto, userId);
  }

  @Post('out')
  @ApiOperation({ summary: 'Stok çıkışı' })
  stockOut(@Body() dto: StockOutDto, @CurrentUser('id') userId: string) {
    return this.stockService.stockOut(dto, userId);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Depolar arası transfer' })
  stockTransfer(@Body() dto: StockTransferDto, @CurrentUser('id') userId: string) {
    return this.stockService.stockTransfer(dto, userId);
  }

  @Roles(Role.MANAGER)
  @Post('adjust')
  @ApiOperation({ summary: 'Sayım düzeltmesi (yönetici)' })
  stockAdjust(@Body() dto: StockAdjustDto, @CurrentUser('id') userId: string) {
    return this.stockService.stockAdjust(dto, userId);
  }
}
