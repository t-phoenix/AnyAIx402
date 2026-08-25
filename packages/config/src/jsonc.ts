export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Removes `//` and block comments plus trailing commas, so operator-facing
 * config files can be heavily annotated while still parsing as JSON.
 * Comment-like sequences inside string literals are preserved.
 */
export function stripJsonComments(input: string): string {
  let output = "";
  let index = 0;
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (index < input.length) {
    const char = input[index] ?? "";
    const next = input[index + 1] ?? "";

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        output += char;
      }
      index += 1;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 2;
        continue;
      }
      if (char === "\n") output += char;
      index += 1;
      continue;
    }

    if (inString) {
      output += char;
      if (char === "\\") {
        output += next;
        index += 2;
        continue;
      }
      if (char === '"') inString = false;
      index += 1;
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 2;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 2;
      continue;
    }

    output += char;
    index += 1;
  }

  return removeTrailingCommas(output);
}

function removeTrailingCommas(input: string): string {
  let output = "";
  let inString = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? "";

    if (inString) {
      output += char;
      if (char === "\\") {
        output += input[index + 1] ?? "";
        index += 1;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      const rest = input.slice(index + 1);
      const nextMeaningful = rest.match(/^\s*([}\]])/);
      if (nextMeaningful) continue;
    }

    output += char;
  }

  return output;
}

export function parseJsonc(contents: string, fileLabel: string): JsonValue {
  const stripped = stripJsonComments(contents);
  try {
    return JSON.parse(stripped) as JsonValue;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${fileLabel} is not valid JSON/JSONC: ${reason}`);
  }
}

/**
 * Flattens a nested config document into dotted paths so it can be matched
 * against each registry entry's `configPath`. Arrays are joined with commas,
 * matching how list-valued environment variables are written.
 */
export function flattenJson(value: JsonValue, prefix = ""): Record<string, string> {
  const flat: Record<string, string> = {};

  if (value === null) return flat;

  if (Array.isArray(value)) {
    if (prefix !== "") flat[prefix] = value.map((entry) => scalarToString(entry)).join(",");
    return flat;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith("$")) continue;
      const path = prefix === "" ? key : `${prefix}.${key}`;
      Object.assign(flat, flattenJson(child, path));
    }
    return flat;
  }

  if (prefix !== "") flat[prefix] = scalarToString(value);
  return flat;
}

function scalarToString(value: JsonValue): string {
  if (value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
