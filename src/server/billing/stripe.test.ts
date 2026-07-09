/// <reference types="jest" />
import { clampSeats, SEAT_RULES } from './stripe';

describe('SEAT_RULES', () => {
  it('encodes the ladder: pro 1, Corner 2–8, org 9+ (999 is the Stripe bound, not copy)', () => {
    expect(SEAT_RULES.pro).toEqual({ min: 1, max: 1 });
    expect(SEAT_RULES.seat).toEqual({ min: 2, max: 8 });
    expect(SEAT_RULES.org).toEqual({ min: 9, max: 999 });
  });
});

describe('clampSeats', () => {
  it('Corner plan: floor 2, ceiling 8 (a Corner is one group)', () => {
    expect(clampSeats('seat', 1)).toBe(2);
    expect(clampSeats('seat', 2)).toBe(2);
    expect(clampSeats('seat', 5)).toBe(5);
    expect(clampSeats('seat', 8)).toBe(8);
    expect(clampSeats('seat', 9)).toBe(8);
    expect(clampSeats('seat', 100)).toBe(8);
  });

  it('org plan: floor 9, effectively no ceiling', () => {
    expect(clampSeats('org', 5)).toBe(9);
    expect(clampSeats('org', 9)).toBe(9);
    expect(clampSeats('org', 40)).toBe(40);
    expect(clampSeats('org', 500)).toBe(500);
  });

  it('pro is always exactly 1', () => {
    expect(clampSeats('pro', 7)).toBe(1);
    expect(clampSeats('pro', 0)).toBe(1);
  });

  it('junk input lands on the plan minimum', () => {
    expect(clampSeats('seat', 'x' as unknown)).toBe(2);
    expect(clampSeats('org', NaN)).toBe(9);
    expect(clampSeats('org', undefined)).toBe(9);
    expect(clampSeats('seat', 4.9)).toBe(4); // floored, then clamped
  });
});
