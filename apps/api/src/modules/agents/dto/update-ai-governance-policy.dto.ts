import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateAIGovernancePolicyDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  liveInferenceEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  dailyCostBudgetUsd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000_000)
  dailyTokenBudget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  providerDailyCostBudgetUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  policyNote?: string;
}
