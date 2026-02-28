import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { GradesController } from './grades.controller.js';
import { GradesService } from './grades.service.js';
import { GradingQueueService } from './grading-queue.service.js';

@Module({
  imports: [PrismaModule, AuthModule, ProjectsModule],
  providers: [GradesService, GradingQueueService],
  controllers: [GradesController],
  exports: [GradesService]
})
export class GradesModule {}
