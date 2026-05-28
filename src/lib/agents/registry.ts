// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require('child_process');

export interface AgentDef {
  id: string;
  binary: string;
  label: string;
  capabilities: string[];
  invocation: string;
  streamFormat: string;
  available: boolean;
  version?: string;
}

/** 顺序与调度优先级一致：hermes > codex > cursor > copilot > gemini > aider */
const KNOWN_AGENTS: Array<Omit<AgentDef, 'available' | 'version'>> = [
  {
    id: 'hermes',
    binary: 'hermes',
    label: 'Hermes Agent',
    capabilities: ['llm_chat', 'code_read', 'code_write', 'code_review'],
    invocation: 'hermes chat -q "{prompt}" --yolo -Q',
    streamFormat: 'stdout',
  },
  {
    id: 'codex',
    binary: 'codex',
    label: 'Codex CLI',
    capabilities: ['code_read', 'code_write'],
    invocation: 'codex exec --json --skip-git-repo-check -c sandbox_workspace_write.network_access=true "{prompt}"',
    streamFormat: 'json',
  },
  {
    id: 'cursor',
    binary: 'cursor-agent',
    label: 'Cursor Agent',
    capabilities: ['code_read', 'code_write', 'code_review'],
    invocation: 'cursor-agent --print --output-format stream-json --force --trust -',
    streamFormat: 'json',
  },
  {
    id: 'copilot',
    binary: 'copilot',
    label: 'GitHub Copilot CLI',
    capabilities: ['code_read', 'code_write', 'code_review'],
    invocation: 'copilot -p "{prompt}" --allow-all-tools --output-format json',
    streamFormat: 'json',
  },
  {
    id: 'gemini',
    binary: 'gemini',
    label: 'Gemini CLI',
    capabilities: ['code_read', 'code_write'],
    invocation: 'GEMINI_CLI_TRUST_WORKSPACE=true gemini --output-format stream-json --yolo -',
    streamFormat: 'json',
  },
  {
    id: 'aider',
    binary: 'aider',
    label: 'Aider',
    capabilities: ['code_read', 'code_write'],
    invocation: 'aider --yes --no-git --message "{prompt}"',
    streamFormat: 'stdout',
  },
];

let _registry: AgentDef[] | null = null;

export function detectAgents(): AgentDef[] {
  if (_registry) return _registry;

  _registry = KNOWN_AGENTS.map((agent) => {
    let available = false;
    let version: string | undefined;

    try {
      const result = execSync(`which ${agent.binary} 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim();

      if (result && result.length > 0) {
        available = true;
        try {
          if (agent.id === 'hermes') {
            version = execSync(`${agent.binary} --version 2>&1 | head -1`, {
              encoding: 'utf-8',
              timeout: 5000,
            }).trim();
          }
        } catch {
          // version fetch failed
        }
      }
    } catch {
      // not found
    }

    return { ...agent, available, version };
  });

  return _registry;
}

export function findAgentByCapability(capability: string): AgentDef | undefined {
  const agents = detectAgents();
  return agents.find((a) => a.available && a.capabilities.includes(capability));
}

export function getAgent(id: string): AgentDef | undefined {
  const agents = detectAgents();
  return agents.find((a) => a.id === id);
}

export function listAvailableAgents(): AgentDef[] {
  return detectAgents().filter((a) => a.available);
}

export function resetAgentCache(): void {
  _registry = null;
}
