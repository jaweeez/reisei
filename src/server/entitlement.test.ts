/// <reference types="jest" />
import { deriveTier } from './entitlement';

describe('deriveTier', () => {
  it('org ownership beats everything', () => {
    expect(deriveTier({ owns_org: true, has_seat: true, user_plan: 'pro' })).toBe('org');
    expect(deriveTier({ owns_org: true, has_seat: false, user_plan: 'free' })).toBe('org');
  });

  it('a sponsored seat beats the personal plan', () => {
    expect(deriveTier({ owns_org: false, has_seat: true, user_plan: 'free' })).toBe('team');
    expect(deriveTier({ owns_org: false, has_seat: true, user_plan: 'pro' })).toBe('team');
  });

  it('falls through to the personal plan', () => {
    expect(deriveTier({ owns_org: false, has_seat: false, user_plan: 'pro' })).toBe('pro');
    expect(deriveTier({ owns_org: false, has_seat: false, user_plan: 'free' })).toBe('free');
  });

  it('a lapsed org owner (owns_org false) falls to their plan, not org', () => {
    expect(deriveTier({ owns_org: false, has_seat: false, user_plan: 'free' })).toBe('free');
  });

  it('empty plan defaults to free', () => {
    expect(deriveTier({ owns_org: false, has_seat: false, user_plan: '' })).toBe('free');
  });
});
