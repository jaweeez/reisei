/// <reference types="jest" />
import { holdHourOf, pickNudge, type TickContext } from './nudges';

const base: TickContext = {
  name: 'Sam Rivera', localHour: 20, holdHour: 20, loggedToday: false,
  current: 5, brokeYesterday: false, missedYesterday: false, hasStandUp: false,
};
const ctx = (over: Partial<TickContext>): TickContext => ({ ...base, ...over });

describe('pickNudge', () => {
  it('a held (logged) day is silence — no nudge', () => {
    expect(pickNudge(ctx({ loggedToday: true }))).toBeNull();
  });

  it('a STAND UP flag beats everything when still open', () => {
    expect(pickNudge(ctx({ hasStandUp: true, localHour: 8, missedYesterday: true }))?.kind).toBe('stand_up');
  });

  it('morning after a break → after_break', () => {
    const n = pickNudge(ctx({ localHour: 7, brokeYesterday: true }));
    expect(n?.kind).toBe('after_break');
    expect(n?.body).toBe("Line broke yesterday. Today it holds or it doesn't. Log.");
  });

  it('morning after going dark → after_miss', () => {
    expect(pickNudge(ctx({ localHour: 8, missedYesterday: true }))?.kind).toBe('after_miss');
  });

  it('at the hold hour, still open → post', () => {
    expect(pickNudge(ctx({ localHour: 20, holdHour: 20 }))?.kind).toBe('post');
  });

  it('two hours before midnight with a real streak → at_risk', () => {
    expect(pickNudge(ctx({ localHour: 22, current: 6 }))?.kind).toBe('at_risk');
  });

  it('no at_risk for a short streak', () => {
    expect(pickNudge(ctx({ localHour: 22, current: 1, holdHour: 8 }))).toBeNull();
  });

  it('a milestone fires on a logged milestone day', () => {
    expect(pickNudge(ctx({ loggedToday: true, current: 30 }))?.kind).toBe('milestone');
  });

  it('mid-afternoon with nothing due → null', () => {
    expect(pickNudge(ctx({ localHour: 14 }))).toBeNull();
  });
});

describe('holdHourOf', () => {
  it('parses HH:MM, defaults to 20', () => {
    expect(holdHourOf('21:30')).toBe(21);
    expect(holdHourOf('07:00')).toBe(7);
    expect(holdHourOf(null)).toBe(20);
    expect(holdHourOf('nonsense')).toBe(20);
  });
});
