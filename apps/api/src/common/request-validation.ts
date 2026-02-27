import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const uuidParamSchema = z.string().uuid();
const shareTokenSchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

export function parseUuidParam(paramName: string, value: string): string {
  const parsed = uuidParamSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(`${paramName} must be a valid UUID.`);
  }
  return parsed.data;
}

export function parseShareTokenParam(paramName: string, value: string): string {
  const parsed = shareTokenSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(
      `${paramName} must be 16-128 chars and contain only alphanumeric, underscore, or hyphen.`
    );
  }
  return parsed.data;
}

export function parsePositiveIntQuery(
  paramName: string,
  value: string | undefined,
  minimum: number,
  maximum: number
): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
    throw new BadRequestException(`${paramName} must be an integer.`);
  }

  if (numeric < minimum || numeric > maximum) {
    throw new BadRequestException(`${paramName} must be between ${minimum} and ${maximum}.`);
  }

  return numeric;
}
