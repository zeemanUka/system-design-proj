import { Controller, Get, Inject, Query } from '@nestjs/common';
import { parsePositiveIntQuery } from '../common/request-validation.js';
import { ScenariosService } from './scenarios.service.js';

@Controller('scenarios')
export class ScenariosController {
  constructor(@Inject(ScenariosService) private readonly scenariosService: ScenariosService) {}

  @Get()
  async listScenarios(
    @Query('difficulty') difficulty?: string,
    @Query('domain') domain?: string,
    @Query('maxMinutes') maxMinutesRaw?: string
  ) {
    const maxMinutes = parsePositiveIntQuery('maxMinutes', maxMinutesRaw, 1, 600);

    return this.scenariosService.listScenarios({
      difficulty,
      domain,
      maxMinutes
    });
  }
}
