import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditService } from '../audit.service';
import { AUDIT_METADATA_KEY, AuditMetadata } from '../decorators/audit.decorator';
import { AuditStatus } from '../entities/audit-log.entity';
import { getErrorMessage } from '@/common/utils/error.utils';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata>(AUDIT_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!metadata) {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const userId = (request as any).user?.userId as string | undefined;
    const resourceId = this.extractResourceId(request);

    return next.handle().pipe(
      tap({
        next: async () => {
          await this.auditService.createLog({
            userId,
            action: metadata.action,
            resourceType: metadata.resourceType,
            resourceId,
            status: AuditStatus.SUCCESS,
            metadata: {
              method: request.method,
              path: request.path,
              statusCode: response.statusCode,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        },
        error: async (error) => {
          this.logger.warn(
            `Audit error record for action=${metadata.action}: ${getErrorMessage(error)}`,
          );

          await this.auditService.createLog({
            userId,
            action: metadata.action,
            resourceType: metadata.resourceType,
            resourceId,
            status: AuditStatus.FAILED,
            message: getErrorMessage(error),
            metadata: {
              method: request.method,
              path: request.path,
              statusCode: response.statusCode,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        },
      }),
    );
  }

  private extractResourceId(request: Request): string | undefined {
    const params = request.params as Record<string, string | undefined>;
    return params.id ?? params.connectionId ?? params.agentId ?? params.positionId ?? undefined;
  }
}
