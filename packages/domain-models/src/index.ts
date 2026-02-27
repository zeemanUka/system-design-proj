export type HealthStatus = 'healthy' | 'degraded' | 'down';

export type ComponentNode = {
  id: string;
  type: string;
  status: HealthStatus;
};
