import { describe, expect, it } from 'vitest';
import { parseCommaSeparated } from './parse-list';

describe('parseCommaSeparated', () => {
  it('parses and trims entries', () => {
    expect(parseCommaSeparated('Meta, Google,  Stripe')).toEqual(['Meta', 'Google', 'Stripe']);
  });

  it('removes empty values', () => {
    expect(parseCommaSeparated('a, , , b')).toEqual(['a', 'b']);
  });
});
