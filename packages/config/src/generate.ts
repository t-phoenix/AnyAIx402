import { CONFIG_GROUPS, CONFIG_REGISTRY, FEATURE_DESCRIPTIONS, REQUIREMENT_RULES } from "./registry.ts";
import type { ConfigEnvironment, ConfigKeyDefinition } from "./types.ts";

const GENERATED_NOTICE =
  "Generated from packages/config/src/registry.ts. Run `bun run packages/config/src/cli.ts template` to regenerate.";

function requirementMarker(definition: ConfigKeyDefinition): string {
  const environments = (["dev", "staging", "production"] as ConfigEnvironment[]).filter(
    (env) => definition.required[env],
  );

  if (environments.length === 3) return "REQUIRED";

  if (environments.length > 0) {
    const features =
      definition.blocksFeatures.length > 0 ? `; also gates ${definition.blocksFeatures.join(", ")}` : "";
    return `REQUIRED FOR: ${environments.join(", ")}${features}`;
  }

  if (definition.blocksFeatures.length > 0) {
    return `REQUIRED FOR: ${definition.blocksFeatures.join(", ")}`;
  }

  return "OPTIONAL";
}

function wrapComment(text: string, width = 96): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current === "") {
      current = word;
    } else if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

function templateValue(definition: ConfigKeyDefinition): string {
  if (definition.default !== undefined) return String(definition.default);
  return "";
}

export function renderEnvExample(): string {
  const lines: string[] = [
    "# AnyX environment variables",
    `# ${GENERATED_NOTICE}`,
    "#",
    "# Copy this file to .env.local (git-ignored) and fill in the values you need:",
    "#   cp .env.example .env.local",
    "#",
    "# Markers:",
    "#   REQUIRED             must be set in every environment",
    "#   REQUIRED FOR: <env>  must be set in those environments",
    "#   REQUIRED FOR: <cap>  optional, but the listed capability stays disabled without it",
    "#   OPTIONAL             safe to leave unset",
    "#",
    "# This file contains no credentials. Every secret is left blank on purpose.",
    "# Account signup steps and costs: config/README.md. Full key reference: docs/configuration.md.",
    "",
  ];

  for (const group of CONFIG_GROUPS) {
    const definitions = CONFIG_REGISTRY.filter((entry) => entry.group === group.group);
    if (definitions.length === 0) continue;

    lines.push(
      "# ".padEnd(100, "="),
      `# ${group.title.toUpperCase()}`,
      ...wrapComment(group.summary).map((line) => `# ${line}`),
      "# ".padEnd(100, "="),
      "",
    );

    for (const definition of definitions) {
      lines.push(...wrapComment(definition.description).map((line) => `# ${line}`));
      lines.push(`# ${requirementMarker(definition)}`);
      if (definition.type === "enum" && definition.enumValues) {
        lines.push(`# Allowed: ${definition.enumValues.join(" | ")}`);
      }
      if (definition.default === undefined) {
        lines.push(`# Example: ${definition.example}`);
      }
      lines.push(`${definition.key}=${templateValue(definition)}`, "");
    }
  }

  lines.push(
    "# ".padEnd(100, "="),
    "# ALTERNATIVES",
    "# Some capabilities accept one of several keys rather than a specific one:",
    ...REQUIREMENT_RULES.map((rule) => `#   ${rule.title} -> one of ${rule.anyOf.join(", ")}`),
    "# ".padEnd(100, "="),
    "",
  );

  return lines.join("\n");
}

function requiredCell(definition: ConfigKeyDefinition): string {
  const environments = (["dev", "staging", "production"] as ConfigEnvironment[]).filter(
    (env) => definition.required[env],
  );
  if (environments.length === 3) return "all";
  if (environments.length === 0) return "no";
  return environments.join(", ");
}

function code(value: string): string {
  return `\`${value}\``;
}

export function renderConfigurationDoc(): string {
  const lines: string[] = [
    "# Configuration reference",
    "",
    `> ${GENERATED_NOTICE}`,
    "",
    "Every configuration key AnyX understands is declared once, in the registry inside",
    "`packages/config`. This page, `.env.example`, and the CLI all read that registry, so the three",
    "can never disagree.",
    "",
    "## How values are resolved",
    "",
    "Sources are consulted in this order, and the first one that supplies a non-empty value wins:",
    "",
    "1. `process.env` — real environment variables, including anything your host injects",
    "2. `.env.local` — your machine-local overrides (git-ignored)",
    "3. `.env` — shared, non-secret defaults for the repository",
    "4. `config/environments/<env>.jsonc` — per-environment overlay for the active environment",
    "5. `config/anyx.config.jsonc` (or `.json`) — the grouped operator config file",
    "6. the default declared in the registry",
    "",
    "Values that look like unfilled placeholders (empty, `<...>`, `CHANGEME`, `TODO`) are treated as",
    "unset, so a half-filled template never masquerades as configuration.",
    "",
    "## CLI",
    "",
    "```bash",
    "bun run packages/config/src/cli.ts check --env dev   # validate; non-zero exit when required keys are missing",
    "bun run packages/config/src/cli.ts list              # every key, grouped, with secrets masked",
    "bun run packages/config/src/cli.ts missing            # only what is unset, with how-to-obtain steps",
    "bun run packages/config/src/cli.ts features          # which capabilities are on, and what unlocks the rest",
    "bun run packages/config/src/cli.ts explain FEE_BPS   # everything known about one key",
    "bun run packages/config/src/cli.ts template          # regenerate .env.example",
    "bun run packages/config/src/cli.ts docs              # regenerate this page",
    "```",
    "",
    "Secrets are masked everywhere (`sk_live_…3456`). No command prints a secret in full.",
    "",
    "## Capabilities",
    "",
    "Missing configuration disables capabilities rather than crashing the process. The",
    "`features` command reports the current state of each.",
    "",
    "| Capability | What it enables |",
    "| --- | --- |",
    ...Object.entries(FEATURE_DESCRIPTIONS).map(([feature, summary]) => `| ${code(feature)} | ${summary} |`),
    "",
    "## Alternatives",
    "",
    "A few requirements are satisfied by any one of several keys:",
    "",
    ...REQUIREMENT_RULES.flatMap((rule) => [
      `- **${rule.title}** — one of ${rule.anyOf.map(code).join(", ")}; enforced in ${rule.requiredIn.join(", ")}.`,
      `  ${rule.howToObtain}`,
    ]),
    "",
    "## Key index",
    "",
    "| Key | Group | Type | Required | Secret | Default |",
    "| --- | --- | --- | --- | --- | --- |",
    ...CONFIG_REGISTRY.map(
      (definition) =>
        `| [${code(definition.key)}](#${definition.key.toLowerCase()}) | ${definition.group} | ${definition.type} | ${requiredCell(definition)} | ${definition.secret ? "yes" : "no"} | ${definition.default === undefined ? "—" : code(String(definition.default))} |`,
    ),
    "",
  ];

  for (const group of CONFIG_GROUPS) {
    const definitions = CONFIG_REGISTRY.filter((entry) => entry.group === group.group);
    if (definitions.length === 0) continue;

    lines.push(`## ${group.title}`, "", group.summary, "");

    for (const definition of definitions) {
      lines.push(
        `### ${definition.key}`,
        "",
        definition.description,
        "",
        `- Config file path: ${code(definition.configPath)}`,
        `- Type: ${definition.type}${definition.enumValues ? ` (${definition.enumValues.map(code).join(" | ")})` : ""}`,
        `- Required in: ${requiredCell(definition)}`,
        `- Secret: ${definition.secret ? "yes — never logged, masked in all output" : "no"}`,
        `- Default: ${definition.default === undefined ? "none" : code(String(definition.default))}`,
        `- Example: ${code(definition.example)}`,
      );

      if (definition.blocksFeatures.length > 0) {
        lines.push(`- Disabled without it: ${definition.blocksFeatures.map(code).join(", ")}`);
      }
      if (definition.docsUrl) {
        lines.push(`- Provider docs: ${definition.docsUrl}`);
      }

      lines.push("", `**How to obtain.** ${definition.howToObtain}`, "");
    }
  }

  return lines.join("\n");
}
