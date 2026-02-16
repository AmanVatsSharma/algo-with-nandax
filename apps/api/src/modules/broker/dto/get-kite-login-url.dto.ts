import { IsNotEmpty, IsString } from 'class-validator';

export class GetKiteLoginUrlDto {
  @IsNotEmpty()
  @IsString()
  apiKey: string;
}
