import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

class BaseMovementDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ example: 'IRS-000123' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class StockInDto extends BaseMovementDto {
  @ApiProperty()
  @IsUUID()
  warehouseId: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({ example: 125.5, description: 'Boşsa ürünün alış fiyatı kullanılır' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  unitCost?: number;
}

export class StockOutDto extends BaseMovementDto {
  @ApiProperty()
  @IsUUID()
  warehouseId: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity: number;
}

export class StockTransferDto extends BaseMovementDto {
  @ApiProperty()
  @IsUUID()
  fromWarehouseId: string;

  @ApiProperty()
  @IsUUID()
  toWarehouseId: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity: number;
}

export class StockAdjustDto extends BaseMovementDto {
  @ApiProperty()
  @IsUUID()
  warehouseId: string;

  @ApiProperty({ example: 42, description: 'Fiziksel sayımda bulunan miktar' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedQuantity: number;

  @ApiProperty({ example: 'Yıl sonu sayımı' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note: string;
}

export class MovementQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
