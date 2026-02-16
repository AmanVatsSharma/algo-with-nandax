import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { BrokerType } from '../entities/broker-connection.entity';

export class CreateConnectionDto {
  @IsNotEmpty()
  @IsEnum(BrokerType)
  brokerType: BrokerType;

  @IsNotEmpty()
  @IsString()
  apiKey: string;
}
