// Pure org helpers — no DB, no env. Trivially unit-testable (see logic.test.ts).

/** What org_join's `note` means for the HTTP layer. Empty rowset (bad/revoked code) is
 *  handled by the route as 404 before this runs. */
export function mapJoinNote(note: string): { status: number; error?: string } {
  if (note === 'org_inactive') {
    return { status: 409, error: "This organization's plan is inactive. Ask the owner to renew it." };
  }
  if (note === 'no_seat') {
    return { status: 409, error: 'No seats open in this organization. Ask the owner to add seats.' };
  }
  // '' (clean join) or 'corner_full' (seated, not placed) are both successes.
  return { status: 200 };
}

/** May one more seat be assigned? (used < purchased) */
export function canAssign(seats: { total: number; used: number }): boolean {
  return seats.used < seats.total;
}
