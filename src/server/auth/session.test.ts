/// <reference types="jest" />
import { REMEMBERED_SESSION_TTL_SECONDS, sessionCookie } from './session';

describe('sessionCookie', () => {
  it('makes a remembered login persist for 90 days', () => {
    expect(sessionCookie('session-token', true)).toContain(`Max-Age=${REMEMBERED_SESSION_TTL_SECONDS}`);
  });

  it('uses a browser-session cookie when the device is not remembered', () => {
    expect(sessionCookie('session-token', false)).not.toContain('Max-Age=');
  });
});
