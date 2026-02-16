import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewAIGovernancePolicyRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reviewNote?: string;
}
