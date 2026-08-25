export type AgentId =
  | "orchestrator"
  | "product"
  | "x402"
  | "ai-integrations"
  | "backend"
  | "frontend"
  | "security"
  | "qa"
  | "devops"
  | "bug-reporter"
  | "bug-fixer"
  | "config-broker";

export type AgentStatus = "ok" | "failed" | "blocked_config" | "skipped";

export type ConfigRequest = {
  id: string;
  createdAt: string;
  agentId: AgentId;
  title: string;
  why: string;
  envVars: string[];
  docs: string;
};

export type BugReport = {
  id: string;
  createdAt: string;
  title: string;
  severity: "low" | "medium" | "high";
  source: AgentId;
  logs: string;
  expected: string;
  actual: string;
};

export type AgentResult = {
  agentId: AgentId;
  status: AgentStatus;
  summary: string;
  artifacts: string[];
  bugs?: BugReport[];
  configRequests?: ConfigRequest[];
  next?: AgentId[];
};

export type RunContext = {
  cwd: string;
  goal: string;
  nested: boolean;
  now: Date;
};

export type RunReport = {
  runId: string;
  goal: string;
  startedAt: string;
  finishedAt: string;
  results: AgentResult[];
  bugs: BugReport[];
  configRequests: ConfigRequest[];
  deploy: { mode: "dry-run" | "live"; notes: string[] };
  ok: boolean;
};
