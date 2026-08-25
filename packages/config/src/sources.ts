import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseDotenv } from "./dotenv.ts";
import { flattenJson, parseJsonc } from "./jsonc.ts";
import { CONFIG_REGISTRY } from "./registry.ts";
import type { ConfigEnvironment, ConfigSource } from "./types.ts";

export interface SourceLayer {
  readonly source: ConfigSource;
  /** Values addressed by environment variable name. */
  readonly values: Readonly<Record<string, string>>;
  readonly file?: string;
}

const CONFIG_FILE_CANDIDATES = ["config/anyx.config.jsonc", "config/anyx.config.json"];

function readFileIfPresent(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  return readFileSync(path, "utf8");
}

function dotenvLayer(cwd: string, file: string, source: ConfigSource): SourceLayer | undefined {
  const path = join(cwd, file);
  const contents = readFileIfPresent(path);
  if (contents === undefined) return undefined;
  return { source, values: parseDotenv(contents), file };
}

/**
 * Config documents are grouped by concern, so their nested paths are mapped
 * back onto environment variable names through each registry entry's
 * `configPath`. Unknown paths are ignored rather than rejected, which keeps
 * operator annotations and future keys from breaking the loader.
 */
function jsonLayer(cwd: string, file: string, source: ConfigSource): SourceLayer | undefined {
  const path = join(cwd, file);
  const contents = readFileIfPresent(path);
  if (contents === undefined) return undefined;

  const flat = flattenJson(parseJsonc(contents, file));
  const values: Record<string, string> = {};

  for (const definition of CONFIG_REGISTRY) {
    const value = flat[definition.configPath];
    if (value !== undefined && value !== "") values[definition.key] = value;
  }

  return { source, values, file };
}

function firstJsonLayer(
  cwd: string,
  candidates: readonly string[],
  source: ConfigSource,
): SourceLayer | undefined {
  for (const candidate of candidates) {
    const layer = jsonLayer(cwd, candidate, source);
    if (layer) return layer;
  }
  return undefined;
}

/**
 * Returns the layers in decreasing precedence order:
 * `process.env`, `.env.local`, `.env`, `config/environments/<env>`,
 * `config/anyx.config`, and finally registry defaults (applied by the loader).
 */
export function collectLayers(options: {
  readonly cwd: string;
  readonly env: ConfigEnvironment;
  readonly processEnv: Readonly<Record<string, string | undefined>>;
  readonly skipFiles: boolean;
}): readonly SourceLayer[] {
  const processValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(options.processEnv)) {
    if (value !== undefined) processValues[key] = value;
  }

  const layers: SourceLayer[] = [{ source: "process.env", values: processValues }];
  if (options.skipFiles) return layers;

  const localEnv = dotenvLayer(options.cwd, ".env.local", ".env.local");
  if (localEnv) layers.push(localEnv);

  const baseEnv = dotenvLayer(options.cwd, ".env", ".env");
  if (baseEnv) layers.push(baseEnv);

  const overlay = firstJsonLayer(
    options.cwd,
    [`config/environments/${options.env}.jsonc`, `config/environments/${options.env}.json`],
    "config/environments",
  );
  if (overlay) layers.push(overlay);

  const base = firstJsonLayer(options.cwd, CONFIG_FILE_CANDIDATES, "config/anyx.config");
  if (base) layers.push(base);

  return layers;
}
