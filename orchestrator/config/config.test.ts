import { describe, expect, test } from 'bun:test';
import { MANUAL_GATES, evaluateGate, unsatisfiedGateIds } from './gates.ts';
import { expandEnv, parseDotenv, resolveConfig, stripJsonComments } from './load.ts';

describe('parseDotenv', () => {
  test('reads plain, quoted, exported and commented lines', () => {
    const parsed = parseDotenv(
      [
        '# a comment',
        '',
        'PLAIN=value',
        'QUOTED="quoted value"',
        "SINGLE='single value'",
        'export EXPORTED=exported',
        'TRAILING=value # inline comment',
        'not a valid line',
      ].join('\n'),
    );

    expect(parsed.PLAIN).toBe('value');
    expect(parsed.QUOTED).toBe('quoted value');
    expect(parsed.SINGLE).toBe('single value');
    expect(parsed.EXPORTED).toBe('exported');
    expect(parsed.TRAILING).toBe('value');
    expect(Object.keys(parsed)).not.toContain('not a valid line');
  });

  test('keeps a URL containing a # fragment intact when quoted', () => {
    expect(parseDotenv('URL="https://example.com/a#b"').URL).toBe('https://example.com/a#b');
  });
});

describe('stripJsonComments', () => {
  test('removes line and block comments and trailing commas', () => {
    const source = `{
      // a line comment
      "a": 1, /* a block comment */
      "b": [2, 3,],
    }`;
    expect(JSON.parse(stripJsonComments(source))).toEqual({ a: 1, b: [2, 3] });
  });

  test('leaves comment-like sequences inside strings alone', () => {
    const source = '{ "url": "https://example.com/a//b", "glob": "/* not a comment */" }';
    const parsed = JSON.parse(stripJsonComments(source)) as Record<string, string>;
    expect(parsed.url).toBe('https://example.com/a//b');
    expect(parsed.glob).toBe('/* not a comment */');
  });
});

describe('expandEnv', () => {
  test('substitutes known variables and leaves unknown ones untouched', () => {
    expect(expandEnv('curl ${BASE}/health', { BASE: 'https://api' })).toBe(
      'curl https://api/health',
    );
    expect(expandEnv('curl ${MISSING}/health', {})).toBe('curl ${MISSING}/health');
  });
});

describe('resolveConfig precedence', () => {
  const layers = {
    repoRoot: '/repo',
    processEnv: { KEY: 'from-process' },
    dotenvLocal: { KEY: 'from-env-local', LOCAL_ONLY: 'local' },
    dotenv: { KEY: 'from-env', ENV_ONLY: 'env' },
    configFile: { env: { KEY: 'from-config-file', FILE_ONLY: 'file' } },
  };

  test('process env beats every file layer', () => {
    expect(resolveConfig(layers).env.KEY).toBe('from-process');
  });

  test('.env.local beats .env which beats the config file', () => {
    const withoutProcess = resolveConfig({ ...layers, processEnv: {} });
    expect(withoutProcess.env.KEY).toBe('from-env-local');

    const withoutDotenvLocal = resolveConfig({ ...layers, processEnv: {}, dotenvLocal: undefined });
    expect(withoutDotenvLocal.env.KEY).toBe('from-env');

    const fileOnly = resolveConfig({
      ...layers,
      processEnv: {},
      dotenvLocal: undefined,
      dotenv: undefined,
    });
    expect(fileOnly.env.KEY).toBe('from-config-file');
  });

  test('layers are merged, not replaced', () => {
    const config = resolveConfig(layers);
    expect(config.env.LOCAL_ONLY).toBe('local');
    expect(config.env.ENV_ONLY).toBe('env');
    expect(config.env.FILE_ONLY).toBe('file');
  });

  test('falls back to built-in defaults when nothing is configured', () => {
    const config = resolveConfig({ repoRoot: '/repo', processEnv: {} });
    expect(config.concurrency).toBeGreaterThan(0);
    expect(config.executor.kind).toBe('dry-run');
    expect(config.deploy.production.autoApprove).toBe(false);
    expect(config.bugs.maxFixAttempts).toBe(3);
  });

  test('environment variables override numeric settings from the config file', () => {
    const config = resolveConfig({
      repoRoot: '/repo',
      processEnv: { ANYX_CONCURRENCY: '7', ANYX_MAX_FIX_ATTEMPTS: '5' },
      configFile: { concurrency: 2, bugs: { maxFixAttempts: 1 } },
    });
    expect(config.concurrency).toBe(7);
    expect(config.bugs.maxFixAttempts).toBe(5);
  });

  test('production auto-approve can only be turned on deliberately', () => {
    const off = resolveConfig({ repoRoot: '/repo', processEnv: {} });
    expect(off.deploy.production.autoApprove).toBe(false);

    const on = resolveConfig({
      repoRoot: '/repo',
      processEnv: { ANYX_DEPLOY_PRODUCTION_AUTO_APPROVE: 'true' },
    });
    expect(on.deploy.production.autoApprove).toBe(true);
  });
});

describe('manual gates', () => {
  test('every gate documents how to obtain it', () => {
    for (const gate of MANUAL_GATES) {
      expect(gate.howToObtain.length).toBeGreaterThan(0);
      expect(gate.signupUrl.startsWith('http')).toBe(true);
      expect(gate.why.length).toBeGreaterThan(0);
    }
  });

  test('gate ids are unique', () => {
    const ids = MANUAL_GATES.map((gate) => gate.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('a gate is satisfied only when all of its required keys are present', () => {
    const gate = MANUAL_GATES.find((entry) => entry.configKeys.length > 1);
    expect(gate).toBeDefined();
    if (!gate) return;

    const [first] = gate.configKeys;
    const partial = evaluateGate(gate, { [String(first)]: 'value' });
    expect(partial.state).toBe('missing');

    const complete = evaluateGate(
      gate,
      Object.fromEntries(gate.configKeys.map((key) => [key, 'value'])),
    );
    expect(complete.state).toBe('satisfied');
  });

  test('an empty string does not satisfy a gate', () => {
    const gate = MANUAL_GATES[0];
    expect(gate).toBeDefined();
    if (!gate) return;
    const state = evaluateGate(
      gate,
      Object.fromEntries(gate.configKeys.map((key) => [key, '   '])),
    );
    expect(state.state).toBe('missing');
  });

  test('waiving a gate marks it waived rather than satisfied', () => {
    const gate = MANUAL_GATES[0];
    expect(gate).toBeDefined();
    if (!gate) return;
    expect(evaluateGate(gate, {}, [gate.id]).state).toBe('waived');
  });

  test('optional gates never block', () => {
    const blocking = unsatisfiedGateIds({});
    for (const id of blocking) {
      expect(MANUAL_GATES.find((gate) => gate.id === id)?.optional).toBe(false);
    }
  });
});
