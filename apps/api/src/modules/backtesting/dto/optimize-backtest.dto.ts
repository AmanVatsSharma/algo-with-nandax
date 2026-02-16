import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class OptimizeBacktestDto {
  @IsNotEmpty()
  @IsString()
  connectionId: string;

  @IsNotEmpty()
  @IsString()
  instrumentToken: string;

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
  @IsInt()
  @Min(1)
  @Max(12)
  walkForwardWindows?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCapital?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsNumber({}, { each: true })
  @Min(0.05, { each: true })
  entryThresholdCandidates?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsNumber({}, { each: true })
  @Min(0.05, { each: true })
  exitThresholdCandidates?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  topN?: number;
}
