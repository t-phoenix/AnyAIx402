import { describe, expect, test } from 'bun:test';
import { downstreamOf, evaluateReadiness, findCycles, topologicalOrder } from './graph.ts';
import { TASK_GRAPH, validateTaskGraph } from './index.ts';
import type { TaskDefinition } from './types.ts';

function task(id: string, dependsOn: readonly string[] = []): TaskDefinition {
  return {
    id,
    title: id,
    phase: 0,
    agentId: 'backend',
    summary: '',
    dependsOn,
    ownedPaths: [],
    acceptanceCriteria: [],
    verifyCommands: [],
    requiredConfigKeys: [],
    requiredManualGates: [],
    status: 'pending',
    priority: 10,
    estimatedComplexity: 'small',
  };
}

describe('topologicalOrder', () => {
  test('orders dependencies before dependents', () => {
    const tasks = [task('c', ['b']), task('a'), task('b', ['a'])];
    const { order, cycles } = topologicalOrder(tasks);

    expect(cycles).toEqual([]);
    expect(order.length).toBe(3);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });

  test('reports a cycle instead of looping forever', () => {
    const tasks = [task('a', ['b']), task('b', ['a'])];
    const result = topologicalOrder(tasks);

    expect(result.cycles.length).toBeGreaterThan(0);
    expect(result.order.length).toBeLessThan(tasks.length);
  });

  test('findCycles names the members of the cycle and excludes acyclic tasks', () => {
    const cycles = findCycles([task('a', ['b']), task('b', ['c']), task('c', ['a']), task('d')]);
    expect(cycles.length).toBe(1);

    // Reported as a closed walk, so the entry node appears at both ends.
    const members = [...new Set(cycles[0] ?? [])].sort();
    expect(members).toEqual(['a', 'b', 'c']);
    expect(members).not.toContain('d');
  });
});

describe('downstreamOf', () => {
  test('collects transitive dependents', () => {
    const tasks = [task('a'), task('b', ['a']), task('c', ['b']), task('unrelated')];
    expect([...downstreamOf(tasks, 'a')].sort()).toEqual(['b', 'c']);
  });
});

describe('evaluateReadiness', () => {
  const tasks = [task('a'), task('b', ['a'])];

  test('a task with unmet dependencies is not ready', () => {
    const [, second] = evaluateReadiness({ tasks, statuses: {}, satisfiedGates: [], env: {} });
    expect(second?.ready).toBe(false);
    expect(second?.unmetDependencies).toEqual(['a']);
  });

  test('completing a dependency unblocks the dependent', () => {
    const [, second] = evaluateReadiness({
      tasks,
      statuses: { a: 'done' },
      satisfiedGates: [],
      env: {},
    });
    expect(second?.ready).toBe(true);
  });

  test('a missing gate blocks a task whose dependencies are met', () => {
    const gated: TaskDefinition = { ...task('gated'), requiredManualGates: ['oneinch'] };
    const [entry] = evaluateReadiness({
      tasks: [gated],
      statuses: {},
      satisfiedGates: [],
      env: {},
    });
    expect(entry?.ready).toBe(false);
    expect(entry?.missingGates).toEqual(['oneinch']);
  });

  test('a missing config key blocks a task', () => {
    const needsKey: TaskDefinition = { ...task('needs'), requiredConfigKeys: ['ONEINCH_API_KEY'] };
    const [blocked] = evaluateReadiness({
      tasks: [needsKey],
      statuses: {},
      satisfiedGates: [],
      env: {},
    });
    expect(blocked?.missingConfigKeys).toEqual(['ONEINCH_API_KEY']);

    const [unblocked] = evaluateReadiness({
      tasks: [needsKey],
      statuses: {},
      satisfiedGates: [],
      env: { ONEINCH_API_KEY: 'value' },
    });
    expect(unblocked?.ready).toBe(true);
  });

  test('ignoreGates bypasses credentials but never dependencies', () => {
    const gated: TaskDefinition = {
      ...task('gated', ['missing-dep']),
      requiredManualGates: ['oneinch'],
      requiredConfigKeys: ['ONEINCH_API_KEY'],
    };
    const [entry] = evaluateReadiness({
      tasks: [gated],
      statuses: {},
      satisfiedGates: [],
      env: {},
      ignoreGates: true,
    });
    expect(entry?.missingGates).toEqual([]);
    expect(entry?.missingConfigKeys).toEqual([]);
    expect(entry?.unmetDependencies).toEqual(['missing-dep']);
    expect(entry?.ready).toBe(false);
  });
});

describe('the shipped AnyX task graph', () => {
  test('is structurally valid', () => {
    const validation = validateTaskGraph();
    expect(validation.errors).toEqual([]);
    expect(validation.cycles).toEqual([]);
  });

  test('can be fully ordered', () => {
    expect(topologicalOrder(TASK_GRAPH).order.length).toBe(TASK_GRAPH.length);
  });

  test('every dependency refers to a real task', () => {
    const ids = new Set(TASK_GRAPH.map((entry) => entry.id));
    for (const entry of TASK_GRAPH) {
      for (const dependency of entry.dependsOn) {
        expect(ids.has(dependency)).toBe(true);
      }
    }
  });
});
