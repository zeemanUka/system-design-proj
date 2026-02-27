import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { ReportsService } from './reports.service.js';
import { SharedReportsController } from './shared-reports.controller.js';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [ProjectsService, ReportsService],
  controllers: [ProjectsController, SharedReportsController],
  exports: [ProjectsService, ReportsService]
})
export class ProjectsModule {}
