import { AuditService } from './audit.service';
import { AuditStatus } from './entities/audit-log.entity';

describe('AuditService', () => {
  const repository = {
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => payload),
    find: jest.fn(async () => []),
  };

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(repository as any);
  });

  it('creates and saves an audit record', async () => {
    await service.createLog({
      userId: 'user-id',
      action: 'trade.execute',
      status: AuditStatus.SUCCESS,
    });

    expect(repository.create).toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalled();
  });

  it('caps user log limit to maximum', async () => {
    await service.getUserLogs('user-id', 10000);
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 200,
      }),
    );
  });
});
