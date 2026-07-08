import { withUser } from '@/server/db';
import { localDateFor } from '@/server/streak';
import type { JournalEntry, JournalFeed } from '@/lib/data/types';

// The log's private store. Free-form entries, RLS owner-only (the policy in 0014 scopes
// every query to current_app_user()). Mirrors the windowing in bearing/history+api.ts:
// free tier sees the last 30 days; Pro sees everything. `date` columns come back from pg
// as JS Date, so we to_char(..,'YYYY-MM-DD') to keep the plain-date client contract.

const FREE_WINDOW_DAYS = 30;

/** Insert a new log entry for the user, stamped with their local calendar date. */
export async function insertEntry(userId: string, body: string): Promise<JournalEntry> {
  return withUser(userId, async (c) => {
    const tz = (await c.query(`select tz from users where id = current_app_user()`)).rows[0]?.tz ?? 'UTC';
    const localDate = localDateFor(tz as string);
    const row = (
      await c.query(
        `insert into journal_entries (user_id, local_date, body)
         values (current_app_user(), $1, $2)
         returning id, to_char(local_date, 'YYYY-MM-DD') as date, body`,
        [localDate, body],
      )
    ).rows[0] as { id: string; date: string; body: string };
    return { id: row.id, date: row.date, body: row.body };
  });
}

/** The user's private log feed. `premium` unlocks the full archive; free is the last 30 days,
 *  with `upsell` flagged when older entries exist beyond that window. */
export async function listEntries(userId: string, premium: boolean): Promise<JournalFeed> {
  return withUser(userId, async (c) => {
    const windowed = !premium;
    const entries = (
      await c.query(
        `select id, to_char(local_date, 'YYYY-MM-DD') as date, body
           from journal_entries
          where user_id = current_app_user()
            ${windowed ? `and local_date >= current_date - interval '${FREE_WINDOW_DAYS} days'` : ''}
          order by created_at desc
          limit 300`,
      )
    ).rows as JournalEntry[];

    let upsell = false;
    if (windowed) {
      const older = (
        await c.query(
          `select 1 from journal_entries
            where user_id = current_app_user()
              and local_date < current_date - interval '${FREE_WINDOW_DAYS} days'
            limit 1`,
        )
      ).rowCount;
      upsell = (older ?? 0) > 0;
    }
    return { entries, upsell };
  });
}
