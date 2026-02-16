import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class GetRiskAnalyticsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(365)
  days?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(80)
  @Max(99.9)
  confidenceLevel?: number;
}
