import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderSide, OrderType } from '../entities/trade.entity';

export class ExecuteTradePayloadDto {
  @IsNotEmpty()
  @IsString()
  symbol: string;

  @IsNotEmpty()
  @IsEnum(OrderSide)
  side: OrderSide;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNotEmpty()
  @IsEnum(OrderType)
  orderType: OrderType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stopLoss?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  takeProfit?: number;
}

export class ExecuteTradeDto {
  @IsNotEmpty()
  @IsString()
  agentId: string;

  @IsNotEmpty()
  @IsString()
  connectionId: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ExecuteTradePayloadDto)
  tradeData: ExecuteTradePayloadDto;
}
