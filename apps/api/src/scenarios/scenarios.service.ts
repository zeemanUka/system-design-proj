import { Inject, Injectable } from '@nestjs/common';
import { Scenario } from '@sdc/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';

type ScenarioFilters = {
  difficulty?: string;
  domain?: string;
  maxMinutes?: number;
};

@Injectable()
export class ScenariosService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listScenarios(filters: ScenarioFilters): Promise<Scenario[]> {
    const scenarios = await this.prisma.scenario.findMany({
      where: {
        isActive: true,
        ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
        ...(filters.domain ? { domain: filters.domain } : {}),
        ...(typeof filters.maxMinutes === 'number'
          ? { estimatedMinutes: { lte: filters.maxMinutes } }
          : {})
      },
      orderBy: [{ difficulty: 'asc' }, { estimatedMinutes: 'asc' }]
    });

    return scenarios.map((scenario) => ({
      id: scenario.id,
      slug: scenario.slug,
      title: scenario.title,
      description: scenario.description,
      difficulty: scenario.difficulty,
      domain: scenario.domain,
      estimatedMinutes: scenario.estimatedMinutes,
      expectedRps: scenario.expectedRps,
      isActive: scenario.isActive,
      createdAt: scenario.createdAt.toISOString(),
      updatedAt: scenario.updatedAt.toISOString()
    }));
  }
}
