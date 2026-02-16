import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { PositionType } from '../entities/position.entity';

export class CreatePositionDto {
  @IsNotEmpty()
  @IsString()
  symbol: string;

  @IsNotEmpty()
  @IsEnum(PositionType)
  type: PositionType;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  averagePrice: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentPrice: number;
}
