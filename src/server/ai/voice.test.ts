/// <reference types="jest" />
import { registerDirective } from './voice';

describe('registerDirective', () => {
  it('adds nothing for the default register (the base voice already carries it)', () => {
    expect(registerDirective()).toBe('');
    expect(registerDirective('default')).toBe('');
    expect(registerDirective('something-unknown')).toBe('');
  });

  it('adds a plain gender-neutral directive for the neutral register', () => {
    const d = registerDirective('neutral');
    expect(d.length).toBeGreaterThan(0);
    expect(d.toLowerCase()).toContain('gender-neutral');
    expect(d.toLowerCase()).toContain('do not assume');
  });
});
