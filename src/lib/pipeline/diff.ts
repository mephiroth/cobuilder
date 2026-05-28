import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { getTruncatedStagingPaths, listStagingFiles } from '@/lib/db/pipeline-db';

const execFileAsync = promisify(execFile);

export async function generateDiff(
  ideaId: string,
  codebaseDir: string
): Promise<{ diff: string; fileCount: number; truncatedFiles: string[] }> {
  const stagingDir = path.join(codebaseDir, '.cobuilder', 'staging', ideaId);
  if (!fs.existsSync(stagingDir)) {
    return { diff: '', fileCount: 0, truncatedFiles: [] };
  }

  let stdout = '';
  try {
    const result = await execFileAsync(
      'diff',
      ['-rN', '--unified=3', codebaseDir, stagingDir],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    stdout = result.stdout;
  } catch (e: unknown) {
    const err = e as { code?: number; stdout?: string };
    if (err.code === 1 && err.stdout) stdout = err.stdout;
    else if (!fs.existsSync(stagingDir)) stdout = '';
    else throw e;
  }

  const files = listStagingFiles(ideaId);
  return {
    diff: stdout,
    fileCount: files.filter((f: { modify_type: string }) => f.modify_type !== 'delete').length,
    truncatedFiles: getTruncatedStagingPaths(ideaId),
  };
}
