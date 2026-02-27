export function parseCommaSeparated(input: string): string[] {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
