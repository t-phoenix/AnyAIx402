/** Minimal glob support: `**`, `*`, `?`. Enough for path-ownership rules. */

function escapeRegExp(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

export function globToRegExp(pattern: string): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i] ?? '';
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        const skipSlash = pattern[i + 2] === '/';
        source += '.*';
        i += skipSlash ? 2 : 1;
      } else {
        source += '[^/]*';
      }
      continue;
    }
    if (ch === '?') {
      source += '[^/]';
      continue;
    }
    source += escapeRegExp(ch);
  }
  return new RegExp(`^${source}$`);
}

export function matchGlob(pattern: string, path: string): boolean {
  return globToRegExp(pattern).test(normalize(path));
}

export function matchAnyGlob(patterns: readonly string[], path: string): boolean {
  return patterns.some((pattern) => matchGlob(pattern, path));
}

function normalize(path: string): string {
  return path.replace(/^\.\//, '').replace(/\/+$/, '');
}

/** Literal directory prefix of a glob, i.e. everything before the first wildcard. */
export function globPrefix(pattern: string): string {
  const normalized = normalize(pattern);
  const wildcard = normalized.search(/[*?]/);
  const head = wildcard === -1 ? normalized : normalized.slice(0, wildcard);
  const lastSlash = head.lastIndexOf('/');
  if (wildcard === -1) return head;
  return lastSlash === -1 ? '' : head.slice(0, lastSlash);
}

/**
 * True when two ownership globs could resolve to the same file. Used to keep two
 * concurrently dispatched agents from editing the same paths — the identical
 * discipline the human-facing agents operate under.
 */
export function globsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  if (matchGlob(a, normalize(b)) || matchGlob(b, normalize(a))) return true;

  const prefixA = globPrefix(a);
  const prefixB = globPrefix(b);
  if (prefixA === '' || prefixB === '') return true;
  if (prefixA === prefixB) return true;
  return isUnder(prefixA, prefixB) || isUnder(prefixB, prefixA);
}

function isUnder(child: string, parent: string): boolean {
  return child === parent || child.startsWith(`${parent}/`);
}

export function anyGlobsOverlap(a: readonly string[], b: readonly string[]): boolean {
  return a.some((left) => b.some((right) => globsOverlap(left, right)));
}
