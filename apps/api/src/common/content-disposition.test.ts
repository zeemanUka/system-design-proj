import { describe, expect, it } from 'vitest';
import { toSafeAttachmentFilename } from './content-disposition.js';

describe('toSafeAttachmentFilename', () => {
  it('removes unsafe header characters', () => {
    expect(toSafeAttachmentFilename('report"\r\nx: y.pdf')).toBe('reportx_y.pdf');
  });

  it('applies fallback when filename is empty', () => {
    expect(toSafeAttachmentFilename('   ')).toBe('report.pdf');
  });
});
