const useColor =
  process.stdout.isTTY === true &&
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== 'dumb';

function wrap(code: string, text: string): string {
  return useColor ? `\u001b[${code}m${text}\u001b[0m` : text;
}

export const color = {
  bold: (text: string): string => wrap('1', text),
  dim: (text: string): string => wrap('2', text),
  red: (text: string): string => wrap('31', text),
  green: (text: string): string => wrap('32', text),
  yellow: (text: string): string => wrap('33', text),
  blue: (text: string): string => wrap('34', text),
  magenta: (text: string): string => wrap('35', text),
  cyan: (text: string): string => wrap('36', text),
};

export function write(line = ''): void {
  process.stdout.write(`${line}\n`);
}

export function heading(text: string): void {
  write();
  write(color.bold(text));
  write(color.dim('─'.repeat(Math.min(text.length, 72))));
}

export function keyValue(key: string, value: string, width = 22): void {
  write(`  ${color.dim(key.padEnd(width))} ${value}`);
}

export type StatusTone = 'ok' | 'warn' | 'error' | 'muted' | 'info';

const MARKS: Record<StatusTone, string> = {
  ok: 'OK',
  warn: '!!',
  error: 'XX',
  muted: '--',
  info: '..',
};

export function mark(tone: StatusTone): string {
  const text = MARKS[tone];
  switch (tone) {
    case 'ok':
      return color.green(text);
    case 'warn':
      return color.yellow(text);
    case 'error':
      return color.red(text);
    case 'info':
      return color.cyan(text);
    case 'muted':
      return color.dim(text);
  }
}

export function status(tone: StatusTone, text: string): void {
  write(`  ${mark(tone)} ${text}`);
}

export function bullet(text: string, indent = 2): void {
  write(`${' '.repeat(indent)}${color.dim('•')} ${text}`);
}

export function table(headers: readonly string[], rows: readonly (readonly string[])[]): void {
  if (rows.length === 0) {
    write(color.dim('  (nothing to show)'));
    return;
  }

  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? '').length)),
  );
  const line = (cells: readonly string[], dim = false): void => {
    const text = cells.map((cell, index) => (cell ?? '').padEnd(widths[index] ?? 0)).join('  ');
    write(`  ${dim ? color.dim(text) : text}`);
  };

  line(headers.map((header) => color.bold(header)));
  line(
    widths.map((width) => '─'.repeat(width)),
    true,
  );
  for (const row of rows) line(row);
}

export function progressBar(done: number, total: number, width = 16): string {
  if (total === 0) return color.dim('─'.repeat(width));
  const filled = Math.round((done / total) * width);
  return `${color.green('█'.repeat(filled))}${color.dim('░'.repeat(width - filled))}`;
}

export function indent(text: string, spaces = 4): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line === '' ? line : `${pad}${line}`))
    .join('\n');
}

/** Never print a credential; enough tail to recognise it, never enough to use it. */
export function maskSecret(value: string): string {
  if (value === '') return '(empty)';
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 3)}${'•'.repeat(6)}${value.slice(-4)}`;
}
