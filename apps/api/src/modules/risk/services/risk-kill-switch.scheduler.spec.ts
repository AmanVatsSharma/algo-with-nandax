import { RiskKillSwitchScheduler } from './risk-kill-switch.scheduler';

describe('RiskKillSwitchScheduler', () => {
  const riskServiceMock = {
    getProfilesForDailyPnLMonitoring: jest.fn(),
    getTodayPnLForUser: jest.fn(),
    evaluateDailyPnL: jest.fn(),
    enableKillSwitch: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips cycle when scheduler is disabled', async () => {
    configServiceMock.get.mockImplementation((key: string, fallback: string) => {
      if (key === 'RISK_AUTO_KILL_SWITCH_ENABLED') {
        return 'false';
      }
      return fallback;
    });

    const scheduler = new RiskKillSwitchScheduler(
      riskServiceMock as any,
      configServiceMock as any,
    );

    await scheduler.evaluateDailyPnLAndKillSwitch();
    expect(riskServiceMock.getProfilesForDailyPnLMonitoring).not.toHaveBeenCalled();
  });

  it('enables kill switch for breached profile', async () => {
    configServiceMock.get.mockImplementation((key: string, fallback: string) => {
      if (key === 'RISK_AUTO_KILL_SWITCH_ENABLED') {
        return 'true';
      }
      if (key === 'RISK_AUTO_KILL_SWITCH_BATCH_SIZE') {
        return '5';
      }
      return fallback;
    });

    riskServiceMock.getProfilesForDailyPnLMonitoring.mockResolvedValue([
      { userId: 'user-1', killSwitchEnabled: false },
    ]);
    riskServiceMock.getTodayPnLForUser.mockResolvedValue(-1500);
    riskServiceMock.evaluateDailyPnL.mockResolvedValue({
      allowed: false,
      reason: 'Daily loss limit breached',
    });

    const scheduler = new RiskKillSwitchScheduler(
      riskServiceMock as any,
      configServiceMock as any,
    );

    await scheduler.evaluateDailyPnLAndKillSwitch();

    expect(riskServiceMock.getProfilesForDailyPnLMonitoring).toHaveBeenCalledWith(5);
    expect(riskServiceMock.enableKillSwitch).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        reason: expect.stringContaining('Daily loss limit breached'),
      }),
    );
  });
});
