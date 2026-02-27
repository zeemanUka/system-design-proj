import { Controller, Get, Inject, Param, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { parseShareTokenParam } from '../common/request-validation.js';
import { ReportsService } from './reports.service.js';

@Controller('shared/reports')
export class SharedReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get(':shareToken')
  async getSharedReport(@Param('shareToken') shareToken: string) {
    return this.reportsService.getSharedReport(parseShareTokenParam('shareToken', shareToken));
  }

  @Get(':shareToken/pdf')
  async downloadSharedReportPdf(
    @Param('shareToken') shareToken: string,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const payload = await this.reportsService.downloadSharedReportPdf(
      parseShareTokenParam('shareToken', shareToken)
    );
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    return payload.buffer;
  }
}
