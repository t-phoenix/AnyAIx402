import { describe, expect, test } from 'bun:test';
import {
  extractSuspectedFiles,
  fingerprintOf,
  normalizeErrorText,
  significantLines,
} from './fingerprint.ts';
import { triage } from './triage.ts';
import type { RawFinding } from './types.ts';

function finding(overrides: Partial<RawFinding> = {}): RawFinding {
  return {
    title: 'something failed',
    source: 'test-run',
    output: 'Error: expected 1 to equal 2',
    ...overrides,
  };
}

describe('normalizeErrorText', () => {
  test('strips the parts that change between identical runs', () => {
    const first = normalizeErrorText(
      'Failed at 2026-01-01T10:00:00Z after 1200ms at /home/a/repo/src/x.ts:10:5',
    );
    const second = normalizeErrorText(
      'Failed at 2026-02-09T22:31:11Z after 87ms at /home/b/repo/src/x.ts:10:5',
    );
    expect(first).toBe(second);
  });

  test('keeps the part of the message that identifies the failure', () => {
    expect(normalizeErrorText('Error: slippage exceeded')).toContain('slippage exceeded');
  });
});

describe('significantLines', () => {
  test('prefers lines that describe a failure over surrounding noise', () => {
    const lines = significantLines(
      ['compiling', 'linking', 'Error: cannot find module viem', 'done'].join('\n'),
    );
    expect(lines).toContain('Error: cannot find module viem');
    expect(lines).not.toContain('compiling');
  });
});

describe('fingerprintOf', () => {
  test('collapses the same failure seen at different times', () => {
    const a = fingerprintOf(
      finding({ output: 'FAIL src/quote.test.ts at 2026-01-01T00:00:00Z took 12ms' }),
    );
    const b = fingerprintOf(
      finding({ output: 'FAIL src/quote.test.ts at 2026-03-04T09:09:09Z took 900ms' }),
    );
    expect(a).toBe(b);
  });

  test('separates genuinely different failures', () => {
    const a = fingerprintOf(finding({ output: 'Error: slippage exceeded' }));
    const b = fingerprintOf(finding({ output: 'Error: facilitator returned 503' }));
    expect(a).not.toBe(b);
  });

  test('separates the same message from different sources', () => {
    const a = fingerprintOf(finding({ source: 'lint' }));
    const b = fingerprintOf(finding({ source: 'test-run' }));
    expect(a).not.toBe(b);
  });
});

describe('extractSuspectedFiles', () => {
  test('finds repo-relative source paths in noisy output', () => {
    const files = extractSuspectedFiles(
      'at packages/core/src/quote.ts:14:3\n  and apps/api/src/routes/pay.ts:9:1\n  ignore /usr/lib/node.js',
    );
    expect(files).toContain('packages/core/src/quote.ts');
    expect(files).toContain('apps/api/src/routes/pay.ts');
    expect(files).not.toContain('/usr/lib/node.js');
  });
});

describe('triage', () => {
  test('routes a slippage failure to swap-routing as critical', () => {
    const result = triage(
      finding({ output: 'Error: slippage exceeded, minAmountOut not met' }),
      [],
    );
    expect(result.agentId).toBe('swap-routing');
    expect(result.severity).toBe('critical');
  });

  test('routes an EIP-3009 failure to the protocol agent', () => {
    const result = triage(
      finding({ output: 'transferWithAuthorization reverted: invalid signature' }),
      [],
    );
    expect(result.agentId).toBe('protocol');
  });

  test('routes a facilitator outage to the protocol agent', () => {
    const result = triage(finding({ output: 'facilitator returned 503 Service Unavailable' }), []);
    expect(result.agentId).toBe('protocol');
  });

  test('is deterministic for the same input', () => {
    const input = finding({ output: 'CCTP attestation never completed' });
    expect(triage(input, [])).toEqual(triage(input, []));
  });

  test('uses file ownership when the message carries no signature', () => {
    const result = triage(finding({ output: 'unexpected token' }), ['packages/sdk/src/index.ts']);
    expect(result.agentId).toBe('sdk');
  });

  test('lint output is routed by file, not by words quoted from source', () => {
    // A lint transcript prints unrelated source lines; one mentioning "slippage"
    // must not make the whole lint run a critical swap-routing bug.
    const result = triage(
      finding({
        source: 'lint',
        title: 'lint failed',
        output:
          "packages/db/src/schema.ts:1:1 lint/style/useConst\n  'slippage exceeded' is a message in another file",
      }),
      ['packages/db/src/schema.ts'],
    );
    expect(result.agentId).toBe('data');
    expect(result.severity).toBe('low');
  });

  test('a configured override wins over every built-in rule', () => {
    const result = triage(
      finding({ output: 'slippage exceeded' }),
      [],
      [{ pattern: 'slippage', agentId: 'qa', severity: 'low' }],
    );
    expect(result.agentId).toBe('qa');
    expect(result.severity).toBe('low');
  });

  test('an unrecognised failure still gets an owner and a stated reason', () => {
    const result = triage(finding({ output: 'something inscrutable happened' }), []);
    expect(result.agentId).toBeTruthy();
    expect(result.rationale.length).toBeGreaterThan(0);
  });
});
