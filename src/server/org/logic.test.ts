/// <reference types="jest" />
import { canAssign, mapJoinNote } from './logic';

describe('mapJoinNote', () => {
  it('clean join and corner_full are both successes (seated either way)', () => {
    expect(mapJoinNote('')).toEqual({ status: 200 });
    expect(mapJoinNote('corner_full')).toEqual({ status: 200 });
  });

  it('org_inactive → 409 with renewal copy', () => {
    const r = mapJoinNote('org_inactive');
    expect(r.status).toBe(409);
    expect(r.error).toMatch(/inactive/i);
  });

  it('no_seat → 409 with add-seats copy', () => {
    const r = mapJoinNote('no_seat');
    expect(r.status).toBe(409);
    expect(r.error).toMatch(/seats/i);
  });
});

describe('canAssign', () => {
  it('allows below capacity, blocks at and past it', () => {
    expect(canAssign({ total: 9, used: 8 })).toBe(true);
    expect(canAssign({ total: 9, used: 9 })).toBe(false);
    expect(canAssign({ total: 9, used: 10 })).toBe(false); // over after a quantity decrease
    expect(canAssign({ total: 0, used: 0 })).toBe(false);
  });
});
