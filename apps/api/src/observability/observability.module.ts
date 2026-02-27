import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ObservabilityService } from './observability.service.js';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [ObservabilityService],
  exports: [ObservabilityService]
})
export class ObservabilityModule {}
