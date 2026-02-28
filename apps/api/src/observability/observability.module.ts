import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ObservabilityController } from './observability.controller.js';
import { ObservabilityService } from './observability.service.js';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [ObservabilityController],
  providers: [ObservabilityService],
  exports: [ObservabilityService]
})
export class ObservabilityModule {}
