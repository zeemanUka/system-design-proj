const MAX_FILENAME_LENGTH = 120;

export function toSafeAttachmentFilename(value: string): string {
  const trimmed = value.trim();
  const fallback = 'report.pdf';
  const candidate = trimmed.length > 0 ? trimmed : fallback;

  const sanitized = candidate
    .replace(/[\r\n"]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, MAX_FILENAME_LENGTH);

  if (!sanitized) {
    return fallback;
  }

  return sanitized.toLowerCase().endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;
}
