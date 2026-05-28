import { getDb } from '@/lib/db';

const DAY_MS = 24 * 60 * 60 * 1000;

export function startNotificationWorker(): void {
  if (process.env.NODE_ENV === 'test') return;

  const tick = () => {
    const db = getDb();
    db.prepare(
      `DELETE FROM notifications WHERE read = 1 AND created_at < datetime('now', '-90 days')`
    ).run();
  };

  setInterval(tick, DAY_MS);
}
