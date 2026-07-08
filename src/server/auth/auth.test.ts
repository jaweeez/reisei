/// <reference types="jest" />
import { hashSecret, validateEmail, validatePin, verifySecret } from './credential';
import { cooldownRemaining, generateCode, RESEND_COOLDOWN_MS, underDailyCap } from './codes';

describe('validateEmail', () => {
  it('accepts normal addresses', () => {
    expect(validateEmail('a@b.co')).toBeNull();
    expect(validateEmail('jalil.test+x@haywayapp.com')).toBeNull();
  });
  it('rejects empty and malformed', () => {
    expect(validateEmail('')).not.toBeNull();
    expect(validateEmail('nope')).not.toBeNull();
    expect(validateEmail('a@b')).not.toBeNull();
    expect(validateEmail('a b@c.com')).not.toBeNull();
  });
});

describe('validatePin', () => {
  it('accepts 4 to 8 digits and rejects the rest', () => {
    expect(validatePin('1234')).toBeNull();
    expect(validatePin('12345678')).toBeNull();
    expect(validatePin('123')).not.toBeNull();
    expect(validatePin('123456789')).not.toBeNull();
    expect(validatePin('12ab')).not.toBeNull();
  });
});

describe('generateCode', () => {
  it('is always a zero-padded 6-digit string', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe('code hashing', () => {
  it('verifies a code against its hash and rejects a wrong one or a null hash', async () => {
    const code = generateCode();
    const hash = await hashSecret(code);
    expect(await verifySecret(code, hash)).toBe(true);
    expect(await verifySecret(code === '000000' ? '111111' : '000000', hash)).toBe(false);
    expect(await verifySecret(code, null)).toBe(false);
  });
});

describe('cooldownRemaining + underDailyCap', () => {
  it('is 0 with no prior send, else counts down to 0', () => {
    const now = 1_000_000;
    expect(cooldownRemaining(null, now)).toBe(0);
    expect(cooldownRemaining(now, now)).toBe(Math.ceil(RESEND_COOLDOWN_MS / 1000));
    expect(cooldownRemaining(now - RESEND_COOLDOWN_MS, now)).toBe(0);
    expect(cooldownRemaining(now - RESEND_COOLDOWN_MS - 5000, now)).toBe(0);
  });
  it('gates at the daily cap', () => {
    expect(underDailyCap(0)).toBe(true);
    expect(underDailyCap(7)).toBe(true);
    expect(underDailyCap(8)).toBe(false);
    expect(underDailyCap(99)).toBe(false);
  });
});
