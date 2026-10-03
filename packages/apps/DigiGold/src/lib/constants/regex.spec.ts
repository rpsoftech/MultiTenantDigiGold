import { EMAIL_PATTERN, MOBILE_NUMBER_PATTERN, OTP_PATTERN } from './regex';

describe('MOBILE_NUMBER_PATTERN', () => {
  it.each(['9876543210', '6000000000', '7123456789', '8999999999'])('accepts %p', (value) => {
    expect(MOBILE_NUMBER_PATTERN.test(value)).toBe(true);
  });

  it.each(['1234567890', '5876543210', '987654321', '98765432100', '98765 43210', '+919876543210', ''])(
    'rejects %p',
    (value) => {
      expect(MOBILE_NUMBER_PATTERN.test(value)).toBe(false);
    },
  );
});

describe('OTP_PATTERN', () => {
  it('accepts exactly six digits', () => {
    expect(OTP_PATTERN.test('123456')).toBe(true);
    expect(OTP_PATTERN.test('000000')).toBe(true);
  });

  it.each(['12345', '1234567', '12345a', '12 456', ''])('rejects %p', (value) => {
    expect(OTP_PATTERN.test(value)).toBe(false);
  });
});

describe('EMAIL_PATTERN', () => {
  it.each(['a@b.co', 'jane.doe@example.com', 'x+tag@mail.example.org'])('accepts %p', (value) => {
    expect(EMAIL_PATTERN.test(value)).toBe(true);
  });

  it.each(['', 'plain', 'a@b', '@b.com', 'a@.com', 'a b@c.com'])('rejects %p', (value) => {
    expect(EMAIL_PATTERN.test(value)).toBe(false);
  });
});
