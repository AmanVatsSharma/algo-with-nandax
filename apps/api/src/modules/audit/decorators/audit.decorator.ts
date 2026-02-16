import { SetMetadata } from '@nestjs/common';

export interface AuditMetadata {
  action: string;
  resourceType?: string;
}

export const AUDIT_METADATA_KEY = 'audit:metadata';

export const Audit = (metadata: AuditMetadata) =>
  SetMetadata(AUDIT_METADATA_KEY, metadata);
