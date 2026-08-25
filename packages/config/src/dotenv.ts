/**
 * Minimal `.env` parser. AnyX ships with zero runtime dependencies, so the
 * dotenv format is implemented here: `KEY=value`, optional `export` prefix,
 * `#` comments, and single- or double-quoted values (escapes honoured inside
 * double quotes only).
 */
export function parseDotenv(contents: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const separator = withoutExport.indexOf("=");
    if (separator <= 0) continue;

    const key = withoutExport.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    result[key] = parseValue(withoutExport.slice(separator + 1).trim());
  }

  return result;
}

function parseValue(rawValue: string): string {
  if (rawValue.startsWith('"')) {
    const closing = findClosingQuote(rawValue, '"');
    if (closing > 0) return unescapeDoubleQuoted(rawValue.slice(1, closing));
  }

  if (rawValue.startsWith("'")) {
    const closing = findClosingQuote(rawValue, "'");
    if (closing > 0) return rawValue.slice(1, closing);
  }

  const commentIndex = rawValue.indexOf(" #");
  const unquoted = commentIndex >= 0 ? rawValue.slice(0, commentIndex) : rawValue;
  return unquoted.trim();
}

function findClosingQuote(value: string, quote: string): number {
  for (let index = 1; index < value.length; index += 1) {
    if (value[index] === "\\" && quote === '"') {
      index += 1;
      continue;
    }
    if (value[index] === quote) return index;
  }
  return -1;
}

function unescapeDoubleQuoted(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}
