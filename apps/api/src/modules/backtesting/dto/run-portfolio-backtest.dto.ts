import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RunPortfolioBacktestDto {
  @IsNotEmpty()
  @IsString()
  connectionId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  instrumentTokens: string[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  weights?: number[];

  @IsNotEmpty()
  @IsString()
  interval: string;

  @IsNotEmpty()
  @IsString()
  fromDate: string;

  @IsNotEmpty()
  @IsString()
  toDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.05)
  entryThresholdPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.05)
  exitThresholdPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feePerTrade?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  slippageBps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.05)
  stopLossPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.05)
  takeProfitPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  walkForwardWindows?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCapital?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  impactBps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  maxParticipationRate?: number;

  @IsOptional()
  @IsString()
  @IsIn(['linear', 'square_root'])
  impactModel?: 'linear' | 'square_root';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  impactVolatilityWeight?: number;
}
