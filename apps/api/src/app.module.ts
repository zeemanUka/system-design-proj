import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { GradesModule } from './grades/grades.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { RunsModule } from './runs/runs.module.js';
import { ScenariosModule } from './scenarios/scenarios.module.js';
import { RateLimitGuard } from './security/rate-limit.guard.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    PrismaModule,
    ObservabilityModule,
    AuthModule,
    UsersModule,
    ScenariosModule,
    ProjectsModule,
    RunsModule,
    GradesModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard
    }
  ]
})
export class AppModule {}
