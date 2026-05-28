import { getDb, createNotification } from '@/lib/db';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const REMINDER_INTERVAL_HOURS = 24;
const MAX_REMINDERS = 3;

export function startGateOverdueWorker(): void {
  if (process.env.NODE_ENV === 'test') return;

  const tick = () => {
    const db = getDb();
    const overdue = db
      .prepare(
        `
      SELECT i.id, COALESCE(g.reminder_count, 0) AS sent_count
      FROM ideas i
      LEFT JOIN gate_overdue_reminders g ON g.idea_id = i.id
      WHERE i.status IN ('pending_prd', 'pending_design', 'pending_merge')
        AND datetime(COALESCE(g.last_sent_at, i.updated_at), '+${REMINDER_INTERVAL_HOURS} hours') < datetime('now')
        AND COALESCE(g.reminder_count, 0) < ${MAX_REMINDERS}
    `
      )
      .all() as Array<{ id: string }>;

    for (const idea of overdue) {
      createNotification(idea.id, 'admin', 'gate_overdue');
      db.prepare(
        `
        INSERT INTO gate_overdue_reminders (idea_id, reminder_count, last_sent_at)
        VALUES (?, 1, datetime('now'))
        ON CONFLICT(idea_id) DO UPDATE SET
          reminder_count = reminder_count + 1,
          last_sent_at = datetime('now')
      `
      ).run(idea.id);
    }
  };

  setInterval(tick, CHECK_INTERVAL_MS);
  tick();
}
