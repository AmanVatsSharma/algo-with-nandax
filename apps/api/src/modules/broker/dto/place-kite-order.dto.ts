import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PlaceKiteOrderDto {
  @IsNotEmpty()
  @IsString()
  tradingsymbol: string;

  @IsNotEmpty()
  @IsString()
  exchange: string;

  @IsNotEmpty()
  @IsString()
  transaction_type: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNotEmpty()
  @IsString()
  order_type: string;

  @IsNotEmpty()
  @IsString()
  product: string;

  @IsNotEmpty()
  @IsString()
  validity: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;
}
