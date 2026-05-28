import * as fs from 'fs';
import * as path from 'path';
import { callMimoWithRetry, callMimoWithTimeout, MODELS } from '@/lib/ai/client';
import { selectBestAgent, killRunningAgent, dispatchAsync } from '@/lib/agents/dispatcher';
import type { AgentDef } from '@/lib/agents/registry';
import {
  recordPipelineRun,
  upsertStagingFile,
  incrementDevRetryCount,
  parseDocContent,
  getLatestDoc,
} from '@/lib/db/pipeline-db';
import type { DevPlan, PRD, UIBrief } from '@/lib/db/types';
import { TaskTooLargeError, TooManyRetriesError } from './errors';
import { runWithTimeout } from './runner';
import { logBus } from './log-bus';
import { validateDevPlan } from './validators';
import type { StageInput, StageModule } from './stage-types';

const MAX_FILES = 20;
const MAX_FILE_BYTES = 50 * 1024;

function extractKeywords(prd: PRD): string[] {
  const words = new Set<string>();
  prd.title.split(/[\s\-_/]+/).forEach((w) => w.length > 1 && words.add(w.toLowerCase()));
  prd.acceptance_criteria.forEach((c) => {
    c.split(/[\s,，。.]+/).forEach((w) => {
      if (w.length > 2) words.add(w.toLowerCase());
    });
  });
  return [...words];
}

function scanCodebase(codebaseDir: string, keywords: string[], limit = 30): string[] {
  const results: string[] = [];
  function walk(dir: string, base: string) {
    if (results.length >= limit) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (results.length >= limit) break;
      if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
      const full = path.join(dir, ent.name);
      const rel = path.join(base, ent.name);
      if (ent.isDirectory()) walk(full, rel);
      else {
        const lower = rel.toLowerCase();
        if (keywords.some((k) => lower.includes(k))) results.push(rel);
      }
    }
  }
  if (fs.existsSync(codebaseDir)) walk(codebaseDir, '');
  return results.slice(0, limit);
}

export async function generateDevPlan(input: StageInput): Promise<DevPlan> {
  const prd = input.previousDocs.prd!;
  const { project } = input;
  let codebase_scanned = false;
  let scan_note = '';
  let filePaths: string[] = [];

  if (!fs.existsSync(project.codebase_dir)) {
    scan_note = '未读取代码库（路径不可用），计划仅供参考';
  } else {
    try {
      fs.accessSync(project.codebase_dir, fs.constants.R_OK);
      const kw = extractKeywords(prd);
      filePaths = scanCodebase(project.codebase_dir, kw, 30);
      codebase_scanned = filePaths.length > 0;
      if (!codebase_scanned) scan_note = '未匹配到相关文件';
    } catch {
      scan_note = '未读取代码库（路径不可用），计划仅供参考';
    }
  }

  const prompt = `你是高级工程师。根据 PRD 生成 Dev_Plan JSON。

<prd>${JSON.stringify(prd)}</prd>
<file_tree>${filePaths.join('\n')}</file_tree>

字段：affected_files[{path, modify_type:add|modify|delete, brief_reason}], steps(3-15), api_changes(0-10), risks(0-5), codebase_scanned(boolean), scan_note`;

  const raw = await callMimoWithRetry({
    prompt,
    model: MODELS.dev_plan,
    system: '只输出合法 JSON，affected_files 最多 20 项',
    retries: 2,
  });
  const plan = validateDevPlan(JSON.parse(raw));
  plan.codebase_scanned = codebase_scanned || plan.codebase_scanned;
  plan.scan_note = scan_note || plan.scan_note;
  if (plan.affected_files.length > MAX_FILES) {
    throw new TaskTooLargeError('受影响文件数超过 20，请人工拆分需求');
  }
  return plan;
}

function buildCodePrompt(file: DevPlan['affected_files'][0], devPlan: DevPlan, prd: PRD, existing?: string): string {
  return `生成文件 ${file.path} 的完整代码（仅输出文件内容，不要 markdown 围栏）。
modify_type: ${file.modify_type}
brief: ${file.brief_reason}
<prd>${JSON.stringify(prd)}</prd>
<dev_plan>${JSON.stringify(devPlan)}</dev_plan>
${existing ? `<existing>${existing.slice(0, 8000)}</existing>` : ''}`;
}

function readExistingFile(codebaseDir: string, relPath: string): string | undefined {
  const p = path.join(codebaseDir, relPath);
  if (!fs.existsSync(p)) return undefined;
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return undefined;
  }
}

async function generateWithFallback(
  input: StageInput,
  devPlan: DevPlan,
  stagingDir: string,
  onLog?: (chunk: string) => void
): Promise<void> {
  const prd = input.previousDocs.prd!;
  const ideaId = input.idea.id;
  onLog?.('[fallback] 本地无可用 CLI Agent，使用 MiMo API 生成代码\n');
  logBus.publish(ideaId, '[fallback] 本地无可用 CLI Agent，使用 MiMo API 生成代码\n');

  const deletes: string[] = [];
  for (const file of devPlan.affected_files) {
    if (file.modify_type === 'delete') {
      deletes.push(file.path);
      upsertStagingFile(ideaId, file.path, 'delete', 0, false);
      onLog?.(`[delete] ${file.path}\n`);
      logBus.publish(ideaId, `[delete] ${file.path}\n`);
      continue;
    }
    const existing = readExistingFile(input.project.codebase_dir, file.path);
    const prompt = buildCodePrompt(file, devPlan, prd, existing);
    const content = await callMimoWithTimeout(prompt, 60_000, MODELS.code_gen);
    let final = content;
    let truncated = false;
    if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_BYTES) {
      final = content.slice(0, MAX_FILE_BYTES);
      truncated = true;
    }
    const dest = path.join(stagingDir, file.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, final, 'utf-8');
    upsertStagingFile(ideaId, file.path, file.modify_type, Buffer.byteLength(final), truncated);
    const msg = `[${file.modify_type}] ${file.path}${truncated ? ' (truncated)' : ''}\n`;
    onLog?.(msg);
    logBus.publish(ideaId, msg);
  }

  const manifest = { deletes, created_at: new Date().toISOString(), used_fallback: true };
  fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

async function dispatchCodingAgent(
  agent: AgentDef,
  input: StageInput,
  devPlan: DevPlan,
  stagingDir: string,
  onLog?: (chunk: string) => void
): Promise<void> {
  const prd = input.previousDocs.prd!;
  const ui = input.previousDocs.uiBrief;
  const prompt = `<prd>${JSON.stringify(prd)}</prd>
<dev_plan>${JSON.stringify(devPlan)}</dev_plan>
${ui ? `<ui_brief>${JSON.stringify(ui)}</ui_brief>` : ''}
请在当前工作目录实现上述变更，直接写入文件。`;

  const ideaId = input.idea.id;
  onLog?.(`[agent] 使用 ${agent.label}\n`);
  logBus.publish(ideaId, `[agent] 使用 ${agent.label}\n`);

  const result = await dispatchAsync(agent, prompt, {
    cwd: stagingDir,
    timeout: 240_000,
    ideaId,
    onOutput: (chunk) => {
      onLog?.(chunk);
      logBus.publish(ideaId, chunk);
    },
  });

  if (!result.success) {
    const prdDoc = getLatestDoc(ideaId, 'prd');
    const version = prdDoc?.version ?? 1;
    const count = incrementDevRetryCount(ideaId, version);
    if (count >= 3) throw new TooManyRetriesError('开发重试已达 3 次，请先修改 PRD');
    throw new Error(result.error || 'CLI Agent 执行失败');
  }

  syncStagingFromDisk(input, stagingDir, devPlan);
}

function syncStagingFromDisk(input: StageInput, stagingDir: string, devPlan: DevPlan): void {
  const ideaId = input.idea.id;
  const codebase = input.project.codebase_dir;
  const deletes: string[] = [];

  function walk(dir: string, base: string) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (name === 'manifest.json') continue;
      const full = path.join(dir, name);
      const rel = path.join(base, name);
      if (fs.statSync(full).isDirectory()) walk(full, rel);
      else {
        const content = fs.readFileSync(full, 'utf-8');
        const exists = fs.existsSync(path.join(codebase, rel));
        const mt = devPlan.affected_files.find((f) => f.path === rel)?.modify_type ?? (exists ? 'modify' : 'add');
        upsertStagingFile(ideaId, rel, mt, Buffer.byteLength(content), false);
      }
    }
  }
  walk(stagingDir, '');

  for (const f of devPlan.affected_files) {
    if (f.modify_type === 'delete') deletes.push(f.path);
  }
  fs.writeFileSync(
    path.join(stagingDir, 'manifest.json'),
    JSON.stringify({ deletes, created_at: new Date().toISOString(), used_fallback: false })
  );
}

async function executeCodeGen(
  input: StageInput,
  devPlan: DevPlan,
  onLog?: (chunk: string) => void
): Promise<void> {
  const stagingDir = path.join(input.project.codebase_dir, '.cobuilder', 'staging', input.idea.id);
  fs.mkdirSync(stagingDir, { recursive: true });

  const agent = selectBestAgent();
  recordPipelineRun(input.idea.id, 'stage3_dev', agent?.id ?? 'mimo_fallback', !agent);

  if (agent) {
    await dispatchCodingAgent(agent, input, devPlan, stagingDir, onLog);
  } else {
    await generateWithFallback(input, devPlan, stagingDir, onLog);
  }
}

export const stage3: StageModule<DevPlan> = {
  name: 'stage3_dev',
  timeoutSeconds: 300,

  async run(input, onLog) {
    let devPlan: DevPlan;
    try {
      devPlan = await runWithTimeout(() => generateDevPlan(input), 60_000, () => {
        /* scan timeout handled inside */
      });
    } catch (e) {
      if (e instanceof TaskTooLargeError) throw e;
      devPlan = {
        affected_files: [{ path: 'README.md', modify_type: 'add', brief_reason: '占位实现' }],
        steps: ['分析需求', '实现功能', '自测'],
        api_changes: [],
        risks: [],
        codebase_scanned: false,
        scan_note: '代码扫描超时，计划仅供参考',
      };
    }

    await runWithTimeout(
      () => executeCodeGen(input, devPlan, onLog),
      240_000,
      () => killRunningAgent(input.idea.id)
    );

    return { doc: devPlan, docType: 'dev_plan' as const };
  },
};
