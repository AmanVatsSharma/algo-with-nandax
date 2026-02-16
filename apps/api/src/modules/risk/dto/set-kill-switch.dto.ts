import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SetKillSwitchDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
