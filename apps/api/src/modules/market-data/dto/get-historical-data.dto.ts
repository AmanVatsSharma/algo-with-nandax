import { IsNotEmpty, IsString } from 'class-validator';

export class GetHistoricalDataDto {
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
  from: string;

  @IsNotEmpty()
  @IsString()
  to: string;
}
