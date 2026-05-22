// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync, spawn } = require('child_process');
import type { AgentDef } from './registry';

export interface DispatchResult {
  agentId: string;
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

function buildCommand(agent: AgentDef, prompt: string): { cmd: string; useStdin: boolean } {
  if (agent.id === 'hermes') {
    return { cmd: `hermes chat -q ${JSON.stringify(prompt)} --yolo -Q 2>&1`, useStdin: false };
  }
  if (agent.id === 'codex') {
    return { cmd: `echo ${JSON.stringify(prompt)} | codex exec --json --skip-git-repo-check -c sandbox_workspace_write.network_access=true 2>&1`, useStdin: false };
  }
  if (agent.id === 'aider') {
    return { cmd: `aider --yes --no-git --message ${JSON.stringify(prompt)} 2>&1`, useStdin: false };
  }
  if (agent.id === 'copilot') {
    return { cmd: `copilot -p ${JSON.stringify(prompt)} --allow-all-tools 2>&1`, useStdin: false };
  }
  // 通用：提取命令部分，prompt 通过 stdin 传递
  const cmdParts = agent.invocation.split(' ').filter((p: string) => !p.includes('{prompt}'));
  return { cmd: cmdParts.join(' '), useStdin: true };
}

/**
 * 同步调用 Agent（适合短任务，如意图分析）
 * Prompt 通过 JSON.stringify 保护或 stdin 传递，避免命令注入
 */
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
  } catch (error: any) {
    return {
      agentId: agent.id,
      success: false,
      output: '',
      error: error.message || String(error),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * 异步调用 Agent（适合长任务，如代码实现）
 */
export function dispatchAsync(
  agent: AgentDef,
  prompt: string,
  options: { timeout?: number; cwd?: string; onOutput?: (chunk: string) => void } = {}
): Promise<DispatchResult> {
  const { timeout = 300000, cwd, onOutput } = options;
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
    } else {
      const cmdParts = agent.invocation.split(' ').filter((p: string) => !p.includes('{prompt}'));
      command = 'sh';
      args = ['-c', cmdParts.join(' ')];
    }

    const proc = spawn(command, args, {
      cwd: cwd || process.cwd(),
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

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

    proc.on('close', (code: number | null) => {
      resolve({
        agentId: agent.id,
        success: code === 0,
        output: stdout.trim(),
        error: code !== 0 ? stderr.trim() || `Exit code: ${code}` : undefined,
        durationMs: Date.now() - start,
      });
    });

    proc.on('error', (error: Error) => {
      resolve({
        agentId: agent.id,
        success: false,
        output: '',
        error: error.message,
        durationMs: Date.now() - start,
      });
    });

    // 通过 stdin 传递 prompt
    proc.stdin?.write(prompt);
    proc.stdin?.end();
  });
}
