import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AgentType } from '../entities/agent.entity';

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  strategyId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(AgentType)
  type?: AgentType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allocatedCapital?: number;

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
