/// <reference types="jest" />
import { daysSince, isMilestoneDay, milestoneReached } from './mode';

describe('daysSince', () => {
  it('is 0 on the start day and counts whole local days', () => {
    expect(daysSince('2026-07-16', '2026-07-16')).toBe(0);
    expect(daysSince('2026-07-16', '2026-07-17')).toBe(1);
    expect(daysSince('2026-06-16', '2026-07-16')).toBe(30);
  });
  it('never goes negative and degrades safely on bad input', () => {
    expect(daysSince('2026-07-20', '2026-07-16')).toBe(0);
    expect(daysSince('nonsense', '2026-07-16')).toBe(0);
  });
});

describe('milestoneReached', () => {
  it('returns null before the first milestone', () => {
    expect(milestoneReached(0)).toBeNull();
  });
  it('returns the highest marker reached', () => {
    expect(milestoneReached(1)!.label).toBe('24 hours');
    expect(milestoneReached(45)!.label).toBe('30 days');
    expect(milestoneReached(200)!.label).toBe('6 months');
    expect(milestoneReached(365)!.label).toBe('1 year');
  });
  it('counts each full year after the first', () => {
    expect(milestoneReached(400)!.label).toBe('1 year');
    expect(milestoneReached(730)!.label).toBe('2 years');
    expect(milestoneReached(1100)!.label).toBe('3 years');
  });
});

describe('isMilestoneDay', () => {
  it('is true exactly on a marker day', () => {
    expect(isMilestoneDay(1)).toBe(true);
    expect(isMilestoneDay(90)).toBe(true);
    expect(isMilestoneDay(365)).toBe(true);
    expect(isMilestoneDay(730)).toBe(true);
  });
  it('is false off a marker and at zero', () => {
    expect(isMilestoneDay(0)).toBe(false);
    expect(isMilestoneDay(45)).toBe(false);
    expect(isMilestoneDay(400)).toBe(false);
  });
});
