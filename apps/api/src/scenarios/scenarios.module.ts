import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ScenariosController } from './scenarios.controller.js';
import { ScenariosService } from './scenarios.service.js';

@Module({
  imports: [PrismaModule],
  providers: [ScenariosService],
  controllers: [ScenariosController],
  exports: [ScenariosService]
})
export class ScenariosModule {}
