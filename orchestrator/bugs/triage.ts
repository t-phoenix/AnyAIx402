import { AGENT_REGISTRY, findAgent } from '../agents/index.ts';
import type { TriageOverride } from '../config/types.ts';
import { matchAnyGlob } from '../shared/glob.ts';
import type { AgentId, Severity } from '../shared/types.ts';
import type { RawFinding } from './types.ts';

export interface TriageResult {
  readonly agentId: AgentId;
  readonly severity: Severity;
  readonly rationale: string;
}

interface SignatureRule {
  readonly pattern: RegExp;
  readonly agentId?: AgentId;
  readonly severity?: Severity;
  readonly why: string;
}

/**
 * Ordered, first-match-wins. These encode the failure signatures the AnyX stack
 * actually produces; anything unmatched falls through to path-based ownership.
 */
const SIGNATURE_RULES: readonly SignatureRule[] = [
  {
    pattern: /slippage|minamountout|insufficient usdc|partial payment/i,
    agentId: 'swap-routing',
    severity: 'critical',
    why: "slippage or minimum-output enforcement failed, which risks overspending a payer's funds",
  },
  {
    pattern: /private key|signer|mnemonic|secret leaked|hardcoded (key|secret)/i,
    agentId: 'security',
    severity: 'critical',
    why: 'a signing-key or secret-handling failure is the highest-severity vector in the threat model',
  },
  {
    pattern:
      /transferwithauthorization|eip-?3009|eip-?712|typed ?data|nonce (reuse|replay|collision)/i,
    agentId: 'protocol',
    severity: 'high',
    why: 'the EIP-3009 authorization path is the settlement primitive',
  },
  {
    pattern: /facilitator|x-payment|402 challenge|paymentrequired|x402/i,
    agentId: 'protocol',
    severity: 'high',
    why: 'x402 challenge or facilitator interaction is failing',
  },
  {
    pattern: /1inch|0x api|zerox|jupiter|quote(engine)?|aggregator|price impact/i,
    agentId: 'swap-routing',
    severity: 'high',
    why: 'DEX quote aggregation is failing',
  },
  {
    pattern: /cctp|attestation|stargate|bridge|reserve ?pool|float/i,
    agentId: 'crosschain',
    severity: 'high',
    why: 'a cross-chain bridging or float-pool path is failing',
  },
  {
    pattern: /lnd|bolt-?11|lightning|macaroon|invoice/i,
    agentId: 'lightning',
    severity: 'medium',
    why: 'Lightning gateway failure',
  },
  {
    pattern: /solidity|forge|foundry|revert|\bsol\b|contract deploy/i,
    agentId: 'contracts',
    severity: 'high',
    why: 'a smart-contract build, test or deployment step failed',
  },
  {
    pattern: /drizzle|migration|postgres|relation .* does not exist|ecconnrefused.*5432|database/i,
    agentId: 'data',
    severity: 'high',
    why: 'schema or database access failure',
  },
  {
    pattern: /redis|ioredis|econnrefused.*6379|rate ?limit/i,
    agentId: 'data',
    severity: 'medium',
    why: 'cache or rate-limit backend failure',
  },
  {
    pattern: /hono|route|middleware|http 5\d\d|listen eaddrinuse|cors/i,
    agentId: 'backend',
    severity: 'high',
    why: 'API server or routing failure',
  },
  {
    pattern: /@anyx\/sdk|upa\.|drop-in fetch/i,
    agentId: 'sdk',
    severity: 'medium',
    why: 'SDK surface failure',
  },
  {
    pattern: /langchain|agentkit|mcp server|function calling|crewai/i,
    agentId: 'integrations',
    severity: 'low',
    why: 'agent-framework integration failure',
  },
  {
    pattern: /openapi|llms\.txt|docs build|broken link|swagger/i,
    agentId: 'docs',
    severity: 'low',
    why: 'documentation artefact failure',
  },
  {
    pattern: /flyctl|docker|deploy|health ?check|rollback|github actions|workflow/i,
    agentId: 'devops',
    severity: 'high',
    why: 'build, deployment or CI infrastructure failure',
  },
  {
    pattern: /coverage (is )?below|coverage threshold|no tests found/i,
    agentId: 'qa',
    severity: 'medium',
    why: 'test-suite completeness gate failed',
  },
];

const SOURCE_SEVERITY: Record<RawFinding['source'], Severity> = {
  'verify-command': 'high',
  'acceptance-criterion': 'high',
  'test-run': 'high',
  typecheck: 'medium',
  lint: 'low',
  'github-actions': 'high',
  'runtime-report': 'critical',
  manual: 'medium',
};

/**
 * Sources whose output is a transcript of many unrelated files rather than a
 * description of one failure. A linter that happens to print a line containing
 * "slippage" is not a slippage bug, so for these the failing file paths are the
 * ground truth and content signatures are advisory at most.
 */
const PATH_AUTHORITATIVE: ReadonlySet<RawFinding['source']> = new Set(['lint', 'typecheck']);

function ownerOfFiles(files: readonly string[]): AgentId | undefined {
  for (const agent of AGENT_REGISTRY) {
    if (agent.id === 'orchestrator') continue;
    if (files.some((file) => matchAnyGlob(agent.ownedPaths, file))) return agent.id;
  }
  return undefined;
}

function applyOverrides(
  haystack: string,
  overrides: readonly TriageOverride[],
): { agentId?: AgentId; severity?: Severity; pattern: string } | undefined {
  for (const override of overrides) {
    let regex: RegExp;
    try {
      regex = new RegExp(override.pattern, 'i');
    } catch {
      continue;
    }
    if (regex.test(haystack)) {
      return { agentId: override.agentId, severity: override.severity, pattern: override.pattern };
    }
  }
  return undefined;
}

/**
 * Deterministic classification: the same failure always routes to the same
 * specialist, so a re-run never reshuffles ownership mid-fix.
 */
export function triage(
  finding: RawFinding,
  suspectedFiles: readonly string[],
  overrides: readonly TriageOverride[] = [],
): TriageResult {
  const haystack = `${finding.title}\n${finding.failingCommand ?? ''}\n${finding.output}`;
  const reasons: string[] = [];

  const override = applyOverrides(haystack, overrides);
  if (override?.agentId && override.severity) {
    return {
      agentId: override.agentId,
      severity: override.severity,
      rationale: `configured triage override /${override.pattern}/`,
    };
  }

  let agentId: AgentId | undefined = finding.agentHint ?? override?.agentId;
  let severity: Severity | undefined = finding.severityHint ?? override?.severity;
  if (finding.agentHint) reasons.push('agent hinted by the intake adapter');
  if (finding.severityHint) reasons.push('severity hinted by the intake adapter');

  const pathAuthoritative = PATH_AUTHORITATIVE.has(finding.source);

  if (agentId === undefined && pathAuthoritative) {
    const byPath = ownerOfFiles(suspectedFiles);
    if (byPath) {
      agentId = byPath;
      reasons.push(`${finding.source} names files owned by the ${byPath} agent`);
    }
  }

  if (agentId === undefined || severity === undefined) {
    const rule = SIGNATURE_RULES.find((candidate) => candidate.pattern.test(haystack));
    // A signature match on a whole-repo transcript says nothing about severity.
    if (rule && !pathAuthoritative) {
      agentId ??= rule.agentId;
      severity ??= rule.severity;
      reasons.push(rule.why);
    }
  }

  if (agentId === undefined) {
    const byPath = ownerOfFiles(suspectedFiles);
    if (byPath) {
      agentId = byPath;
      reasons.push(`the failing files are owned by the ${byPath} agent`);
    }
  }

  if (agentId === undefined) {
    agentId = finding.source === 'lint' || finding.source === 'typecheck' ? 'qa' : 'orchestrator';
    reasons.push('no signature or path match; routed to the default owner');
  }

  severity ??= SOURCE_SEVERITY[finding.source];
  reasons.push(`source ${finding.source} defaults to ${severity}`);

  const agent = findAgent(agentId);
  return {
    agentId,
    severity,
    rationale: `${agent ? agent.name : agentId}: ${reasons.join('; ')}`,
  };
}
