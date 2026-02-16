import { IsNotEmpty, IsString } from 'class-validator';

export class ConnectKiteDto {
  @IsNotEmpty()
  @IsString()
  connectionId: string;

  @IsNotEmpty()
  @IsString()
  requestToken: string;

  @IsNotEmpty()
  @IsString()
  apiSecret: string;
}
