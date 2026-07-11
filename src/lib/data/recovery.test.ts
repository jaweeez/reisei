/// <reference types="jest" />
import { RECOVERY_FRICTION_LABEL, RECOVERY_FRICTIONS, RECOVERY_MOVES } from './types';

describe('recovery plan choices', () => {
  it('keeps every stored friction representable in the client', () => {
    expect(RECOVERY_FRICTIONS.map((friction) => RECOVERY_FRICTION_LABEL[friction])).toEqual([
      'Time got away',
      'Low energy',
      'Conflict hit',
      'I avoided it',
    ]);
  });

  it('offers a concrete next move instead of an open-ended verdict', () => {
    expect(RECOVERY_MOVES).toHaveLength(4);
    expect(RECOVERY_MOVES).toContain('Set the cue earlier');
  });
});
