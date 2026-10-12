import { describe, expect, it } from '@jest/globals';
import { mapKycDocuments } from './admin.service';

const EMPTY = { panNumber: undefined, aadhaarLast4: undefined, other: [] };

describe('mapKycDocuments', () => {
  it.each([null, undefined, 'text', 42, [], {}])(
    'returns empty documents for %p',
    (raw) => {
      expect(mapKycDocuments(raw)).toEqual(EMPTY);
    },
  );

  it('reads the known fields', () => {
    expect(
      mapKycDocuments({ pan_number: 'ABCDE1234F', aadhaar_last4: '4821' }),
    ).toEqual({ panNumber: 'ABCDE1234F', aadhaarLast4: '4821', other: [] });
  });

  it('keeps unknown scalar fields, drops unusable ones and ignores wrong-typed known fields', () => {
    expect(
      mapKycDocuments({
        pan_number: 12345,
        aadhaar_last4: { nested: true },
        voter_id: 'XYZ123',
        empty_field: '  ',
        object_field: { a: 1 },
      }),
    ).toEqual({
      panNumber: '12345',
      aadhaarLast4: undefined,
      other: [{ label: 'voter id', value: 'XYZ123' }],
    });
  });
});
