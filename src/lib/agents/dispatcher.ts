// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync, spawn } = require('child_process');
import type { ChildProcess } from 'child_process';
import type { AgentDef } from './registry';
import { detectAgents } from './registry';

export interface DispatchResult {
  agentId: string;
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

const AGENT_PRIORITY = ['hermes', 'codex', 'cursor', 'copilot', 'gemini', 'aider'] as const;
const runningAgents = new Map<string, ChildProcess>();

let _agentCache: AgentDef[] | null = null;
let _agentCacheAt = 0;
const CACHE_MS = 60_000;

function getAgentsCached(): AgentDef[] {
  if (_agentCache && Date.now() - _agentCacheAt < CACHE_MS) return _agentCache;
  _agentCache = detectAgents();
  _agentCacheAt = Date.now();
  return _agentCache;
}

let _selectAgentOverride: (() => AgentDef | null) | undefined;

export function setSelectBestAgentForTests(fn: (() => AgentDef | null) | undefined): void {
  _selectAgentOverride = fn;
}

export function selectBestAgent(): AgentDef | null {
  if (_selectAgentOverride) return _selectAgentOverride();
  const agents = getAgentsCached();
  for (const id of AGENT_PRIORITY) {
    const a = agents.find((x) => x.id === id && x.available);
    if (a) return a;
  }
  return null;
}

export function killRunningAgent(ideaId: string): void {
  const proc = runningAgents.get(ideaId);
  if (proc) {
    try {
      proc.kill('SIGKILL');
    } catch {
      /* ignore */
    }
    runningAgents.delete(ideaId);
  }
}

function buildCommand(agent: AgentDef, prompt: string): { cmd: string; useStdin: boolean } {
  if (agent.id === 'hermes') {
    return { cmd: `hermes chat -q ${JSON.stringify(prompt)} --yolo -Q 2>&1`, useStdin: false };
  }
  if (agent.id === 'codex') {
    return {
      cmd: `echo ${JSON.stringify(prompt)} | codex exec --json --skip-git-repo-check -c sandbox_workspace_write.network_access=true 2>&1`,
      useStdin: false,
    };
  }
  if (agent.id === 'aider') {
    return { cmd: `aider --yes --no-git --message ${JSON.stringify(prompt)} 2>&1`, useStdin: false };
  }
  if (agent.id === 'copilot') {
    return { cmd: `copilot -p ${JSON.stringify(prompt)} --allow-all-tools 2>&1`, useStdin: false };
  }
  const cmdParts = agent.invocation.split(' ').filter((p: string) => !p.includes('{prompt}'));
  return { cmd: cmdParts.join(' '), useStdin: true };
}

export function dispatchSync(
  agent: AgentDef,
  prompt: string,
  options: { timeout?: number; cwd?: string } = {}
): DispatchResult {
  const { timeout = 120000, cwd } = options;
  const start = Date.now();

  try {
    const { cmd, useStdin } = buildCommand(agent, prompt);
    const output = execSync(cmd, {
      input: useStdin ? prompt : undefined,
      encoding: 'utf-8',
      timeout,
      cwd: cwd || process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
    });
    return { agentId: agent.id, success: true, output: output.trim(), durationMs: Date.now() - start };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      agentId: agent.id,
      success: false,
      output: '',
      error: err.message || String(error),
      durationMs: Date.now() - start,
    };
  }
}

export function dispatchAsync(
  agent: AgentDef,
  prompt: string,
  options: {
    timeout?: number;
    cwd?: string;
    onOutput?: (chunk: string) => void;
    ideaId?: string;
  } = {}
): Promise<DispatchResult> {
  const { timeout = 300000, cwd, onOutput, ideaId } = options;
  const start = Date.now();

  return new Promise((resolve) => {
    let command: string;
    let args: string[];

    if (agent.id === 'hermes') {
      command = 'hermes';
      args = ['chat', '-q', prompt, '--yolo', '-Q'];
    } else if (agent.id === 'codex') {
      command = 'codex';
      args = ['exec', '--json', '--skip-git-repo-check', '-c', 'sandbox_workspace_write.network_access=true'];
    } else if (agent.id === 'cursor') {
      command = 'cursor-agent';
      args = ['--print', '--output-format', 'stream-json', '--force', '--trust'];
    } else {
      const cmdParts = agent.invocation.split(' ').filter((p: string) => !p.includes('{prompt}'));
      command = 'sh';
      args = ['-c', cmdParts.join(' ')];
    }

    const proc = spawn(command, args, {
      cwd: cwd || process.cwd(),
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    }) as ChildProcess;

    if (ideaId) runningAgents.set(ideaId, proc);

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      onOutput?.(chunk);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const finish = (result: DispatchResult) => {
      if (ideaId) runningAgents.delete(ideaId);
      resolve(result);
    };

    proc.on('close', (code: number | null) => {
      finish({
        agentId: agent.id,
        success: code === 0,
        output: stdout.trim(),
        error: code !== 0 ? stderr.trim() || `Exit code: ${code}` : undefined,
        durationMs: Date.now() - start,
      });
    });

    proc.on('error', (error: Error) => {
      finish({
        agentId: agent.id,
        success: false,
        output: '',
        error: error.message,
        durationMs: Date.now() - start,
      });
    });

    proc.stdin?.write(prompt);
    proc.stdin?.end();
  });
}
