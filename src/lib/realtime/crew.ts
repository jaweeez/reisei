/**
 * Crew realtime via AWS AppSync Events (the MuWorks house realtime — see the Lambda
 * authorizer in MuWorksModules/infra/realtime-authorizer).
 *
 * Presence is ALWAYS derived from today's check_ins on the server (survives
 * reconnects); AppSync Events is only a nudge to refetch. Launch posture is
 * "poll + push-invalidate": subscribe to crew/{crewId}, and on any event just
 * re-run fetchState(). This module is a thin stub until the AppSync app is
 * provisioned and the env vars are filled in.
 *
 * Env: EXPO_PUBLIC_APPSYNC_EVENTS_HTTP_ENDPOINT, EXPO_PUBLIC_APPSYNC_EVENTS_REALTIME_ENDPOINT,
 *      EXPO_PUBLIC_APPSYNC_REGION, APPSYNC_EVENTS_NAMESPACE.
 */

const HTTP_ENDPOINT = process.env.EXPO_PUBLIC_APPSYNC_EVENTS_HTTP_ENDPOINT;
const NAMESPACE = process.env.APPSYNC_EVENTS_NAMESPACE || 'crew';

export function realtimeEnabled(): boolean {
  return Boolean(HTTP_ENDPOINT);
}

/**
 * Subscribe to a crew's presence channel. `onChange` fires when a crewmate checks
 * in; the caller should re-run fetchState(). Returns an unsubscribe fn.
 *
 * TODO: wire the AppSync Events WebSocket client once the AppSync app + authorizer
 * are provisioned. Until then this is a no-op so the UI can ship on poll-only.
 */
export function subscribeCrew(crewId: string, _onChange: () => void): () => void {
  if (!realtimeEnabled()) return () => {};
  const channel = `${NAMESPACE}/${crewId}`;
  void channel;
  // Placeholder: connect to EXPO_PUBLIC_APPSYNC_EVENTS_REALTIME_ENDPOINT, subscribe
  // to `channel`, call _onChange() on message, and return the socket teardown.
  return () => {};
}
