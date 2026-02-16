import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CloseTradeDto {
  @IsNotEmpty()
  @IsString()
  connectionId: string;

  @IsOptional()
  @IsString()
  exitReason?: string;
}
