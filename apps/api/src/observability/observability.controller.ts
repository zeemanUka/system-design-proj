import { BadRequestException, Body, Controller, Inject, Post, Req } from '@nestjs/common';
import { frontendMetricRequestSchema } from '@sdc/shared-types';
import { FastifyRequest } from 'fastify';
import { ObservabilityService } from './observability.service.js';

type MetricRequestWithUser = FastifyRequest & {
  user?: {
    sub?: string;
  };
};

@Controller('observability')
export class ObservabilityController {
  constructor(@Inject(ObservabilityService) private readonly observability: ObservabilityService) {}

  @Post('frontend-metrics')
  async captureFrontendMetric(@Req() request: MetricRequestWithUser, @Body() body: unknown) {
    const parsed = frontendMetricRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const userAgentHeader = request.headers['user-agent'];
    const userAgent = typeof userAgentHeader === 'string' ? userAgentHeader : null;

    await this.observability.recordFrontendMetric({
      name: parsed.data.metric.name,
      value: parsed.data.metric.value,
      path: parsed.data.metric.path,
      rating: parsed.data.metric.rating,
      navigationType: parsed.data.metric.navigationType,
      userId: request.user?.sub ?? null,
      ipAddress: request.ip ?? null,
      userAgent
    });

    return {
      ok: true
    };
  }
}
