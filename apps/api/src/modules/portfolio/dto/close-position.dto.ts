import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class ClosePositionDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentPrice: number;
}
