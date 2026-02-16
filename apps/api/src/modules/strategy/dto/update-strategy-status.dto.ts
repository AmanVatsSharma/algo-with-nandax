import { IsEnum, IsNotEmpty } from 'class-validator';
import { StrategyStatus } from '../entities/strategy.entity';

export class UpdateStrategyStatusDto {
  @IsNotEmpty()
  @IsEnum(StrategyStatus)
  status: StrategyStatus;
}
