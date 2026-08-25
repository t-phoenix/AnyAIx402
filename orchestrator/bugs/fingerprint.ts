import { createHash } from 'node:crypto';
import type { RawFinding } from './types.ts';

const NOISE_PATTERNS: readonly [RegExp, string][] = [
  [/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?Z?\b/g, '<timestamp>'],
  [/\b0x[0-9a-fA-F]{6,}\b/g, '<hex>'],
  [/\b[0-9a-fA-F]{32,}\b/g, '<hash>'],
  [/\b\d+(\.\d+)?\s?(ms|s|seconds|minutes)\b/g, '<duration>'],
  [/:\d+:\d+/g, ':<line>:<col>'],
  [/(^|[\s"'(])\/(?:[\w.-]+\/)+[\w.-]+/g, '$1<abs-path>'],
  [/\b\d{4,}\b/g, '<num>'],
  [/\s+/g, ' '],
];

/**
 * Strips the parts of an error that change between otherwise identical runs, so
 * the same failure produces the same fingerprint on Tuesday and on Friday.
 */
export function normalizeErrorText(text: string): string {
  let normalized = text.trim();
  for (const [pattern, replacement] of NOISE_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.trim().toLowerCase();
}

/** The most information-dense lines of an error, used as the signature body. */
export function significantLines(output: string, max = 5): readonly string[] {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const interesting = lines.filter((line) =>
    /error|fail|expected|assert|cannot|unable|refused|timeout|denied|not found|undefined|exception|panic|revert/i.test(
      line,
    ),
  );

  const chosen = interesting.length > 0 ? interesting : lines;
  return chosen.slice(0, max);
}

export function fingerprintOf(finding: RawFinding): string {
  const signature = [
    finding.source,
    normalizeErrorText(finding.failingCommand ?? ''),
    ...significantLines(finding.output).map(normalizeErrorText),
  ].join('|');

  return createHash('sha256').update(signature).digest('hex').slice(0, 16);
}

export function bugIdFor(fingerprint: string): string {
  return `bug-${fingerprint.slice(0, 8)}`;
}

const FILE_PATTERN = /(?:^|[\s"'(:])((?:packages|apps|orchestrator|scripts|tests|security|growth|config)\/[\w./-]+\.(?:ts|tsx|js|sol|json|yaml|yml|sh|md))/g;

/** Repo-relative source files named anywhere in the error output. */
export function extractSuspectedFiles(output: string, extra: readonly string[] = []): string[] {
  const found = new Set<string>(extra);
  for (const match of output.matchAll(FILE_PATTERN)) {
    const path = match[1];
    if (path) found.add(path.replace(/[),:]+$/, ''));
  }
  return [...found].sort().slice(0, 20);
}

export function excerptOf(output: string, maxChars = 2000): string {
  const lines = significantLines(output, 20);
  const text = lines.length > 0 ? lines.join('\n') : output.trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n… (truncated)` : text;
}
