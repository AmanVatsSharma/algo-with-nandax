import { IsOptional, IsString, MaxLength } from 'class-validator';
import { UpdateAIGovernancePolicyDto } from './update-ai-governance-policy.dto';

export class CreateAIGovernancePolicyRequestDto extends UpdateAIGovernancePolicyDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  requestNote?: string;
}
