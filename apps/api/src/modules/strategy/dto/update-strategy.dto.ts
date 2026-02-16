import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { StrategyType, TimeFrame } from '../entities/strategy.entity';

export class UpdateStrategyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(StrategyType)
  type?: StrategyType;

  @IsOptional()
  @IsEnum(TimeFrame)
  timeFrame?: TimeFrame;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instruments?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxCapitalPerTrade?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stopLossPercentage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  takeProfitPercentage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPositions?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxTradesPerDay?: number;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  entryRules?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  exitRules?: Record<string, unknown>;
}
