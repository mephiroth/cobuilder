import * as fs from 'fs';
import * as path from 'path';
import { getDb } from '@/lib/db';
import { writeAuditLog } from '@/lib/db/pipeline-db';
import { createNotification, getIdea } from '@/lib/db';
import { logBus } from './log-bus';

export function mergeStagingToMain(
  ideaId: string,
  codebaseDir: string,
  actorId: 'admin' | 'system'
): void {
  const stagingDir = path.join(codebaseDir, '.cobuilder', 'staging', ideaId);
  const manifestPath = path.join(stagingDir, 'manifest.json');
  const manifest = fs.existsSync(manifestPath)
    ? (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { deletes?: string[] })
    : { deletes: [] as string[] };

  const db = getDb();
  const resolvedBase = path.resolve(codebaseDir);

  db.exec('BEGIN IMMEDIATE');
  try {
    const files = db
      .prepare(
        `SELECT rel_path, modify_type FROM staging_files WHERE idea_id = ? AND modify_type != 'delete'`
      )
      .all(ideaId) as Array<{ rel_path: string; modify_type: string }>;

    for (const file of files) {
      const src = path.join(stagingDir, file.rel_path);
      const dest = path.join(codebaseDir, file.rel_path);
      if (!path.resolve(dest).startsWith(resolvedBase)) {
        throw new Error(`非法路径越界: ${file.rel_path}`);
      }
      if (!fs.existsSync(src)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }

    for (const delPath of manifest.deletes ?? []) {
      const target = path.join(codebaseDir, delPath);
      if (!path.resolve(target).startsWith(resolvedBase)) {
        throw new Error(`非法路径越界: ${delPath}`);
      }
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }

    if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
    db.prepare('DELETE FROM staging_files WHERE idea_id = ?').run(ideaId);

    db.prepare(`UPDATE ideas SET status = 'done', updated_at = datetime('now') WHERE id = ?`).run(ideaId);

    writeAuditLog(db, {
      ideaId,
      actorId,
      eventType: 'gate_decision',
      from: 'pending_merge',
      to: 'done',
      metadata: { gate: 'gate3', decision: 'approve' },
    });

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const idea = getIdea(ideaId);
  if (idea?.client_id) {
    createNotification(ideaId, idea.client_id, 'published');
  }
  if (idea?.author_contact) {
    createNotification(ideaId, idea.client_id ?? 'external', 'external_pending');
  }
  logBus.clear(ideaId);
}
