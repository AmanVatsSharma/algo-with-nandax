import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AgentType } from '../entities/agent.entity';

export class CreateAgentDto {
  @IsNotEmpty()
  @IsString()
  strategyId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(AgentType)
  type?: AgentType;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allocatedCapital: number;

  @IsOptional()
  @IsBoolean()
  autoTrade?: boolean;

  @IsOptional()
  @IsBoolean()
  paperTrading?: boolean;

  @IsOptional()
  @IsString()
  aiModelName?: string;

  @IsOptional()
  @IsString()
  aiModelVersion?: string;

  @IsOptional()
  @IsObject()
  aiModelConfig?: Record<string, unknown>;
}
