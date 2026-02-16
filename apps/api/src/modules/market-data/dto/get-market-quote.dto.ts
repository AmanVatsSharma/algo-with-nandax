import { IsNotEmpty, IsString } from 'class-validator';

export class GetMarketQuoteDto {
  @IsNotEmpty()
  @IsString()
  connectionId: string;

  @IsNotEmpty()
  @IsString()
  instruments: string;
}
