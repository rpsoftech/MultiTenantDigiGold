import { kycSchema } from './kyc.schema';

const valid = { panNumber: 'ABCDE1234F', aadhaarLast4: '1234', documentUrl: '' };

describe('kycSchema', () => {
  it('accepts valid details with no document link', () => {
    expect(kycSchema.safeParse(valid).success).toBe(true);
  });

  it('uppercases the PAN', () => {
    const result = kycSchema.safeParse({ ...valid, panNumber: 'abcde1234f' });
    expect(result.success && result.data.panNumber).toBe('ABCDE1234F');
  });

  it.each(['ABCDE12345', 'ABCD1234F', '1234567890', ''])('rejects PAN %p', (panNumber) => {
    expect(kycSchema.safeParse({ ...valid, panNumber }).success).toBe(false);
  });

  it.each(['123', '12345', 'abcd', ''])('rejects Aadhaar last 4 %p', (aadhaarLast4) => {
    expect(kycSchema.safeParse({ ...valid, aadhaarLast4 }).success).toBe(false);
  });

  it('accepts an https document link and rejects other values', () => {
    expect(kycSchema.safeParse({ ...valid, documentUrl: 'https://example.com/doc.pdf' }).success).toBe(true);
    expect(kycSchema.safeParse({ ...valid, documentUrl: 'http://example.com/doc.pdf' }).success).toBe(false);
    expect(kycSchema.safeParse({ ...valid, documentUrl: 'not a url' }).success).toBe(false);
  });
});
