import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AIGovernancePolicyRequest } from '../entities/ai-governance-policy-request.entity';
import { CreateAIGovernancePolicyRequestDto } from '../dto/create-ai-governance-policy-request.dto';
import { ReviewAIGovernancePolicyRequestDto } from '../dto/review-ai-governance-policy-request.dto';
import { AIGovernancePolicyService } from './ai-governance-policy.service';
import { UpdateAIGovernancePolicyDto } from '../dto/update-ai-governance-policy.dto';
import { UserRole } from '@/modules/users/entities/user.entity';

@Injectable()
export class AIGovernancePolicyRequestService {
  private readonly logger = new Logger(AIGovernancePolicyRequestService.name);

  constructor(
    @InjectRepository(AIGovernancePolicyRequest)
    private readonly policyRequestRepository: Repository<AIGovernancePolicyRequest>,
    private readonly configService: ConfigService,
    private readonly aiGovernancePolicyService: AIGovernancePolicyService,
  ) {}

  isApprovalRequired(): boolean {
    const raw = this.configService.get<string>('AI_GOVERNANCE_REQUIRE_APPROVAL', 'false');
    return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
  }

  async createRequest(input: {
    requestedByUserId: string;
    targetUserId: string;
    dto: CreateAIGovernancePolicyRequestDto | UpdateAIGovernancePolicyDto;
  }) {
    const request = this.policyRequestRepository.create({
      requestedByUserId: input.requestedByUserId,
      targetUserId: input.targetUserId,
      status: 'pending',
      requestedPolicy: this.normalizePolicyPayload(input.dto),
      requestNote:
        'requestNote' in input.dto ? (input.dto.requestNote ?? null) : null,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNote: null,
    });
    const saved = await this.policyRequestRepository.save(request);
    this.logger.log(
      `ai-governance-policy-request-created: requestId=${saved.id} requestedBy=${saved.requestedByUserId} targetUser=${saved.targetUserId}`,
    );
    return saved;
  }

  async listRequestsForUser(input: {
    userId: string;
    role?: string;
    limit?: number;
  }) {
    const take = Math.min(Math.max(input.limit ?? 50, 1), 500);
    const isAdmin = String(input.role ?? '').toLowerCase() === UserRole.ADMIN;
    this.logger.debug(
      `ai-governance-policy-request-list: userId=${input.userId} role=${input.role ?? 'unknown'} take=${take}`,
    );

    if (isAdmin) {
      return this.policyRequestRepository.find({
        order: { createdAt: 'DESC' },
        take,
      });
    }

    return this.policyRequestRepository.find({
      where: [{ requestedByUserId: input.userId }, { targetUserId: input.userId }],
      order: { createdAt: 'DESC' },
      take,
    });
  }

  async approveRequest(input: {
    requestId: string;
    reviewerUserId: string;
    reviewerRole?: string;
    dto: ReviewAIGovernancePolicyRequestDto;
  }) {
    this.ensureAdmin(input.reviewerRole);
    const request = await this.getRequestById(input.requestId);
    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be approved');
    }

    await this.aiGovernancePolicyService.updatePolicyProfile(
      request.targetUserId,
      request.requestedPolicy as UpdateAIGovernancePolicyDto,
    );
    this.logger.log(
      `ai-governance-policy-request-approved: requestId=${request.id} reviewer=${input.reviewerUserId} targetUser=${request.targetUserId}`,
    );

    await this.policyRequestRepository.update(request.id, {
      status: 'approved',
      reviewedByUserId: input.reviewerUserId,
      reviewedAt: new Date(),
      reviewNote: input.dto.reviewNote ?? null,
    });
    this.logger.log(
      `ai-governance-policy-request-rejected: requestId=${request.id} reviewer=${input.reviewerUserId} targetUser=${request.targetUserId}`,
    );
    return this.getRequestById(request.id);
  }

  async rejectRequest(input: {
    requestId: string;
    reviewerUserId: string;
    reviewerRole?: string;
    dto: ReviewAIGovernancePolicyRequestDto;
  }) {
    this.ensureAdmin(input.reviewerRole);
    const request = await this.getRequestById(input.requestId);
    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    await this.policyRequestRepository.update(request.id, {
      status: 'rejected',
      reviewedByUserId: input.reviewerUserId,
      reviewedAt: new Date(),
      reviewNote: input.dto.reviewNote ?? null,
    });
    return this.getRequestById(request.id);
  }

  private async getRequestById(requestId: string) {
    const request = await this.policyRequestRepository.findOne({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException('AI governance policy request not found');
    }
    return request;
  }

  private ensureAdmin(role?: string) {
    if (String(role ?? '').toLowerCase() !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can review governance policy requests');
    }
  }

  private normalizePolicyPayload(dto: CreateAIGovernancePolicyRequestDto | UpdateAIGovernancePolicyDto) {
    return {
      ...(dto.liveInferenceEnabled !== undefined
        ? { liveInferenceEnabled: dto.liveInferenceEnabled }
        : {}),
      ...(dto.dailyCostBudgetUsd !== undefined ? { dailyCostBudgetUsd: dto.dailyCostBudgetUsd } : {}),
      ...(dto.dailyTokenBudget !== undefined ? { dailyTokenBudget: dto.dailyTokenBudget } : {}),
      ...(dto.providerDailyCostBudgetUsd !== undefined
        ? { providerDailyCostBudgetUsd: dto.providerDailyCostBudgetUsd }
        : {}),
      ...(dto.policyNote !== undefined ? { policyNote: dto.policyNote } : {}),
    } as Record<string, unknown>;
  }
}
