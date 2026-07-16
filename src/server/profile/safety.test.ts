/// <reference types="jest" />
// Force the keyword-only path (no model call) so classification is deterministic and offline.
jest.mock('@/server/ai/anthropic', () => ({
  chatEnabled: () => false,
  anthropic: () => ({}),
  CHAT_MODEL: 'test',
}));
// eslint-disable-next-line import/first -- jest.mock must be declared before the module under test is imported
import { screenEntry } from './safety';

describe('safety screen — keyword layer', () => {
  it('flags overdose / use-to-end-it intent as dark (recovery patterns)', async () => {
    for (const t of [
      'I want to overdose tonight',
      "I don't care if I overdose anymore",
      'I am going to take the whole bottle',
      'I want to use until I stop breathing',
    ]) {
      expect(await screenEntry(t)).toBe('dark');
    }
  });

  it('still flags the existing suicide / self-harm language as dark', async () => {
    expect(await screenEntry('I want to die')).toBe('dark');
    expect(await screenEntry('thinking about killing myself')).toBe('dark');
  });

  it('does NOT flag ordinary cravings, urges, or an honest slip', async () => {
    for (const t of [
      'the craving is loud today and it keeps circling back',
      'strong urge to use but I am white-knuckling it',
      'I slipped last night and I feel like garbage about it',
      'so angry I could scream',
    ]) {
      expect(await screenEntry(t)).toBe('ok');
    }
  });
});
