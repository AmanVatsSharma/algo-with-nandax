import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class InstrumentsSubscriptionDto {
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  instruments: string[];
}
