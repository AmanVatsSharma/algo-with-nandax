import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ReconcileTradesDto {
  @IsOptional()
  @IsString()
  tradeId?: string;

  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxItems?: number;
}
