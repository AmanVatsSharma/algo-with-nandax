import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePortfolioDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentCapital?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalPnL?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  todayPnL?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
