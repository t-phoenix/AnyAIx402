#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { renderConfigurationDoc, renderEnvExample } from "./generate.ts";
import { loadConfig, resolveEnvironment } from "./load.ts";
import { CONFIG_GROUPS, CONFIG_REGISTRY, findKey } from "./registry.ts";
import type { ConfigEnvironment, ConfigKeyDefinition, LoadConfigResult } from "./types.ts";

interface Args {
  readonly command: string;
  readonly positional: readonly string[];
  readonly env?: ConfigEnvironment;
  readonly json: boolean;
  readonly stdout: boolean;
  readonly cwd: string;
}

const USAGE = `AnyX configuration CLI

Usage:
  bun run packages/config/src/cli.ts <command> [options]

Commands:
  check [--env <dev|staging|production>]   Validate configuration; exits 1 when required keys are missing
  list                                     Print every key, grouped, with masked current values
  missing                                  Print only unset keys, with how-to-obtain instructions
  features                                 Print which capabilities are enabled and what unlocks the rest
  explain <KEY>                            Print everything known about one key
  template [--stdout]                      Regenerate .env.example from the registry
  docs [--stdout]                          Regenerate docs/configuration.md from the registry

Options:
  --env <name>   Environment profile to validate against (default: ANYX_ENV, else dev)
  --json         Machine-readable output (check, list, missing, features, explain)
  --stdout       Print generated content instead of writing the file
  --cwd <path>   Repository root to read .env / config files from
`;

function parseArgs(argv: readonly string[]): Args {
  const positional: string[] = [];
  let env: ConfigEnvironment | undefined;
  let json = false;
  let stdout = false;
  let cwd = process.cwd();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--json") json = true;
    else if (arg === "--stdout") stdout = true;
    else if (arg === "--env") {
      const value = argv[index + 1];
      env = resolveEnvironment(value);
      index += 1;
    } else if (arg.startsWith("--env=")) env = resolveEnvironment(arg.slice(6));
    else if (arg === "--cwd") {
      cwd = resolve(argv[index + 1] ?? cwd);
      index += 1;
    } else if (arg.startsWith("--cwd=")) cwd = resolve(arg.slice(6));
    else if (!arg.startsWith("-")) positional.push(arg);
  }

  return {
    command: positional[0] ?? "help",
    positional: positional.slice(1),
    env,
    json,
    stdout,
    cwd,
  };
}

function requirementLabel(definition: ConfigKeyDefinition, env: ConfigEnvironment): string {
  if (definition.required[env]) return "required";
  if (definition.blocksFeatures.length > 0) return `optional (gates ${definition.blocksFeatures.join(", ")})`;
  return "optional";
}

function print(line = ""): void {
  process.stdout.write(`${line}\n`);
}

function printHeader(result: LoadConfigResult): void {
  print(`environment: ${result.env}`);
  print(
    `sources: process.env${result.loadedFiles.length > 0 ? `, ${result.loadedFiles.join(", ")}` : ""}, registry defaults`,
  );
  print();
}

function commandCheck(result: LoadConfigResult, json: boolean): number {
  if (json) {
    print(JSON.stringify({ env: result.env, validation: result.validation, features: result.features }, null, 2));
    return result.validation.ok ? 0 : 1;
  }

  printHeader(result);

  const { missing, invalid, warnings } = result.validation;

  if (missing.length > 0) {
    print(`Missing required configuration (${missing.length}):`);
    for (const entry of missing) {
      print();
      print(`  ${entry.key}`);
      print(`    ${entry.message}`);
      print(`    How to obtain: ${entry.howToObtain}`);
      if (entry.docsUrl) print(`    Provider docs: ${entry.docsUrl}`);
      if (entry.blocksFeatures.length > 0) print(`    Blocks: ${entry.blocksFeatures.join(", ")}`);
    }
    print();
  }

  if (invalid.length > 0) {
    print(`Invalid values (${invalid.length}):`);
    for (const entry of invalid) {
      print();
      print(`  ${entry.key}`);
      print(`    ${entry.message}`);
      print(`    How to obtain: ${entry.howToObtain}`);
    }
    print();
  }

  if (warnings.length > 0) {
    print(`Warnings (${warnings.length}) — AnyX runs, with these capabilities disabled:`);
    for (const entry of warnings) print(`  ${entry.key}: ${entry.message}`);
    print();
  }

  const disabled = result.featureReport.filter((entry) => !entry.enabled);
  const enabled = result.featureReport.filter((entry) => entry.enabled);
  print(`Capabilities enabled: ${enabled.length}/${result.featureReport.length}`);
  if (disabled.length > 0) {
    print(`Disabled: ${disabled.map((entry) => entry.feature).join(", ")}`);
    print("Run `missing` or `features` for the exact keys that unlock them.");
  }
  print();

  if (result.validation.ok) {
    print(`Configuration is valid for the ${result.env} environment.`);
    return 0;
  }

  print(
    `Configuration is NOT valid for the ${result.env} environment: ${missing.length} missing, ${invalid.length} invalid.`,
  );
  return 1;
}

function commandList(result: LoadConfigResult, json: boolean): number {
  if (json) {
    print(
      JSON.stringify(
        {
          env: result.env,
          values: Object.values(result.values).map((value) => ({
            key: value.key,
            group: value.group,
            source: value.source,
            secret: value.secret,
            value: value.display,
          })),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  printHeader(result);

  for (const group of CONFIG_GROUPS) {
    const definitions = CONFIG_REGISTRY.filter((entry) => entry.group === group.group);
    if (definitions.length === 0) continue;

    print(`[${group.group}] ${group.title}`);
    for (const definition of definitions) {
      const resolved = result.values[definition.key];
      const shown = resolved?.display === "" ? "(unset)" : resolved?.display ?? "(unset)";
      const source = resolved?.source ?? "unset";
      print(
        `  ${definition.key.padEnd(36)} ${shown.padEnd(48)} [${source}] ${requirementLabel(definition, result.env)}`,
      );
    }
    print();
  }

  return 0;
}

function commandMissing(result: LoadConfigResult, json: boolean): number {
  const unset = CONFIG_REGISTRY.filter((definition) => result.values[definition.key]?.raw === undefined);

  if (json) {
    print(
      JSON.stringify(
        unset.map((definition) => ({
          key: definition.key,
          group: definition.group,
          required: definition.required[result.env],
          usingDefault: result.values[definition.key]?.source === "default",
          default: definition.default ?? null,
          blocksFeatures: definition.blocksFeatures,
          howToObtain: definition.howToObtain,
          docsUrl: definition.docsUrl ?? null,
        })),
        null,
        2,
      ),
    );
    return 0;
  }

  printHeader(result);

  const required = unset.filter(
    (definition) => definition.required[result.env] && result.values[definition.key]?.source !== "default",
  );
  const optional = unset.filter((definition) => !required.includes(definition));

  if (required.length === 0 && optional.length === 0) {
    print("Every key in the registry has an explicit value.");
    return 0;
  }

  if (required.length > 0) {
    print(`Required and unset in ${result.env} (${required.length}) — AnyX will not start:`);
    for (const definition of required) {
      print();
      print(`  ${definition.key}  [${definition.group}]`);
      print(`    ${definition.description}`);
      print(`    Example: ${definition.example}`);
      print(`    How to obtain: ${definition.howToObtain}`);
      if (definition.docsUrl) print(`    Provider docs: ${definition.docsUrl}`);
      if (definition.blocksFeatures.length > 0) {
        print(`    Disabled without it: ${definition.blocksFeatures.join(", ")}`);
      }
    }
    print();
  }

  const gating = optional.filter((definition) => definition.blocksFeatures.length > 0);
  const inert = optional.filter((definition) => definition.blocksFeatures.length === 0);

  if (gating.length > 0) {
    print(`Unset and gating a capability (${gating.length}):`);
    for (const definition of gating) {
      print();
      print(`  ${definition.key}  [${definition.group}]`);
      print(`    Disabled without it: ${definition.blocksFeatures.join(", ")}`);
      print(`    How to obtain: ${definition.howToObtain}`);
    }
    print();
  }

  if (inert.length > 0) {
    print(`Unset but harmless — a registry default applies (${inert.length}):`);
    print(`  ${inert.map((definition) => definition.key).join(", ")}`);
    print();
  }

  return 0;
}

function commandFeatures(result: LoadConfigResult, json: boolean): number {
  if (json) {
    print(JSON.stringify({ env: result.env, features: result.featureReport }, null, 2));
    return 0;
  }

  printHeader(result);

  for (const entry of result.featureReport) {
    const state = entry.enabled ? "on " : "off";
    print(`  [${state}] ${entry.feature.padEnd(36)} ${entry.summary}`);
    if (!entry.enabled && entry.missingKeys.length > 0) {
      print(`         needs: ${entry.missingKeys.join(", ")}`);
    }
  }
  print();
  return 0;
}

function commandExplain(result: LoadConfigResult, rawKey: string | undefined, json: boolean): number {
  if (rawKey === undefined) {
    print("explain requires a key, for example: explain DATABASE_URL");
    return 2;
  }

  const definition = findKey(rawKey);
  if (!definition) {
    print(`Unknown configuration key: ${rawKey}`);
    print("Run `list` to see every key AnyX understands.");
    return 2;
  }

  const resolved = result.values[definition.key];

  if (json) {
    print(
      JSON.stringify(
        {
          ...definition,
          validate: definition.validate === undefined ? null : "custom",
          current: { source: resolved?.source ?? "unset", value: resolved?.display ?? "" },
        },
        null,
        2,
      ),
    );
    return 0;
  }

  print(definition.key);
  print("=".repeat(definition.key.length));
  print();
  print(definition.description);
  print();
  print(`  group:             ${definition.group}`);
  print(`  config file path:  ${definition.configPath}`);
  print(
    `  type:              ${definition.type}${definition.enumValues ? ` (${definition.enumValues.join(" | ")})` : ""}`,
  );
  print(
    `  required:          dev=${definition.required.dev} staging=${definition.required.staging} production=${definition.required.production}`,
  );
  print(`  secret:            ${definition.secret ? "yes (masked in all output)" : "no"}`);
  print(`  default:           ${definition.default === undefined ? "(none)" : String(definition.default)}`);
  print(`  example:           ${definition.example}`);
  print(
    `  current value:     ${resolved?.display === "" ? "(unset)" : resolved?.display} [${resolved?.source ?? "unset"}]`,
  );
  if (definition.blocksFeatures.length > 0) {
    print(`  disabled without:  ${definition.blocksFeatures.join(", ")}`);
  }
  if (definition.docsUrl) print(`  provider docs:     ${definition.docsUrl}`);
  print();
  print("How to obtain");
  print("-------------");
  print(definition.howToObtain);
  print();
  return 0;
}

function writeGenerated(path: string, contents: string, toStdout: boolean): number {
  if (toStdout) {
    process.stdout.write(contents);
    return 0;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
  print(`Wrote ${path}`);
  return 0;
}

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);

  if (args.command === "help" || args.command === "--help") {
    process.stdout.write(USAGE);
    return 0;
  }

  const result = loadConfig({ env: args.env, cwd: args.cwd });

  switch (args.command) {
    case "check":
      return commandCheck(result, args.json);
    case "list":
      return commandList(result, args.json);
    case "missing":
      return commandMissing(result, args.json);
    case "features":
      return commandFeatures(result, args.json);
    case "explain":
      return commandExplain(result, args.positional[0], args.json);
    case "template":
      return writeGenerated(join(args.cwd, ".env.example"), renderEnvExample(), args.stdout);
    case "docs":
      return writeGenerated(join(args.cwd, "docs/configuration.md"), renderConfigurationDoc(), args.stdout);
    default:
      print(`Unknown command: ${args.command}`);
      process.stdout.write(USAGE);
      return 2;
  }
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}

export { main, parseArgs };
