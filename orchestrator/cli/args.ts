export interface ParsedArgs {
  readonly command: string;
  readonly subcommand?: string;
  readonly positionals: readonly string[];
  readonly flags: Readonly<Record<string, string | boolean>>;
}

/**
 * Minimal `--flag`, `--key value`, `--key=value`, `-x` parsing. Dependency-free
 * on purpose: the orchestrator has to run before `bun install` ever has.
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i] ?? '';

    if (token.startsWith('--')) {
      const body = token.slice(2);
      const eq = body.indexOf('=');
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        flags[body] = next;
        i += 1;
      } else {
        flags[body] = true;
      }
      continue;
    }

    if (token.startsWith('-') && token.length > 1) {
      flags[token.slice(1)] = true;
      continue;
    }

    positionals.push(token);
  }

  const [command = 'help', subcommand, ...rest] = positionals;
  return { command, subcommand, positionals: rest, flags };
}

export function flagString(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags[name];
  return typeof value === 'string' ? value : undefined;
}

export function flagBool(args: ParsedArgs, name: string): boolean {
  return args.flags[name] === true || args.flags[name] === 'true';
}

export function flagNumber(args: ParsedArgs, name: string): number | undefined {
  const raw = flagString(args, name);
  if (raw === undefined) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function flagList(args: ParsedArgs, name: string): readonly string[] {
  const raw = flagString(args, name);
  if (raw === undefined) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}
