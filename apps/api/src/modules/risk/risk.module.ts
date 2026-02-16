import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskProfile } from './entities/risk-profile.entity';
import { RiskAlert } from './entities/risk-alert.entity';
import { RiskService } from './risk.service';
import { RiskController } from './risk.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RiskProfile, RiskAlert])],
  providers: [RiskService],
  controllers: [RiskController],
  exports: [RiskService],
})
export class RiskModule {}
