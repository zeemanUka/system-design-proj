import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RunsController } from './runs.controller.js';
import { RunsService } from './runs.service.js';
import { SimulationQueueService } from './simulation-queue.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [RunsService, SimulationQueueService],
  controllers: [RunsController],
  exports: [RunsService]
})
export class RunsModule {}
