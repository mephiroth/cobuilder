export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV === 'test') return;

  const { startNotificationWorker } = await import('./src/lib/notifications/worker');
  const { startGateOverdueWorker } = await import('./src/lib/notifications/gate-overdue-worker');
  startNotificationWorker();
  startGateOverdueWorker();
}
