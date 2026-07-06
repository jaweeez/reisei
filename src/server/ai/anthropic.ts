import { createAnthropic } from '@ai-sdk/anthropic';

// Shared Claude provider (Vercel AI SDK), mirroring the MuWorks house pattern.
// Pinned to @ai-sdk/anthropic 1.x (AI SDK v4). Accept either env name for the key.
export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '',
});

// Haiku for the latency-sensitive coach nudge. Configurable — set CHAT_MODEL to
// raise it (e.g. claude-sonnet-5 / claude-opus-4-8) for deeper reflections.
export const CHAT_MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5';

export const chatEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
