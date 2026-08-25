import {
  BASE_ASSETS,
  BASE_MAINNET,
  LOCAL_TEST_FEE_BPS,
  PRODUCTION_FEE_BPS,
  parseCaip2,
  parseErc20Caip19,
} from "@anyx/sdk";
import { z } from "zod";

const secretReferenceSchema = z
  .string()
  .regex(/^secret:\/\/[a-z0-9][a-z0-9._/-]*[a-z0-9]$/, "must be a secret:// reference");

const caip2Schema = z.string().transform((value, context) => {
  try {
    return parseCaip2(value);
  } catch (error) {
    context.addIssue({ code: "custom", message: (error as Error).message });
    return z.NEVER;
  }
});

const erc20Caip19Schema = z.string().transform((value, context) => {
  try {
    return parseErc20Caip19(value).asset;
  } catch (error) {
    context.addIssue({ code: "custom", message: (error as Error).message });
    return z.NEVER;
  }
});

export const anyxConfigSchema = z
  .object({
    apiVersion: z.literal("config.anyx.dev/v1alpha1"),
    environment: z.enum(["local", "test", "staging", "production"]),
    payments: z
      .object({
        protocolVersion: z.literal(2),
        network: caip2Schema,
        settlementAsset: erc20Caip19Schema,
        acquisitionAssets: z
          .array(z.enum([BASE_ASSETS.eth, BASE_ASSETS.weth, BASE_ASSETS.usdtBridged]))
          .min(1)
          .refine((values) => new Set(values.map((value) => value.toLowerCase())).size === values.length, {
            message: "acquisitionAssets cannot contain duplicates",
          }),
        feeBps: z.number().int().min(0).max(9999),
        maxFeeBps: z.number().int().min(0).max(9999),
        collectFeeOnchain: z.literal(false),
        rpcRef: secretReferenceSchema.optional(),
        facilitatorCredentialRef: secretReferenceSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((config, context) => {
    if (config.payments.network !== BASE_MAINNET) {
      context.addIssue({
        code: "custom",
        path: ["payments", "network"],
        message: `MVP supports only ${BASE_MAINNET}`,
      });
    }
    if (config.payments.settlementAsset !== BASE_ASSETS.usdc) {
      context.addIssue({
        code: "custom",
        path: ["payments", "settlementAsset"],
        message: "MVP settlement asset must be canonical Base USDC",
      });
    }
    if (config.payments.feeBps > config.payments.maxFeeBps) {
      context.addIssue({
        code: "custom",
        path: ["payments", "feeBps"],
        message: "feeBps exceeds maxFeeBps",
      });
    }
  });

export type AnyxConfig = z.infer<typeof anyxConfigSchema>;

const SENSITIVE_KEY = /(?:api[_-]?key|private[_-]?key|secret|password|passwd|mnemonic|seed|token)$/i;
const PRIVATE_KEY_VALUE = /^(?:0x)?[0-9a-fA-F]{64}$/;
const AUTHENTICATED_URL = /^[a-z][a-z0-9+.-]*:\/\/[^/\s]+:[^@\s]+@/i;

function rejectInlineSecrets(value: unknown, path: readonly string[] = []): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectInlineSecrets(entry, [...path, String(index)]));
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const entryPath = [...path, key];
    if (key.endsWith("Ref")) {
      if (typeof entry !== "string" || !entry.startsWith("secret://")) {
        throw new ConfigSecurityError(`${entryPath.join(".")} must contain a secret reference`);
      }
    } else if (SENSITIVE_KEY.test(key)) {
      throw new ConfigSecurityError(`${entryPath.join(".")} cannot contain an inline secret`);
    }
    if (
      typeof entry === "string" &&
      (PRIVATE_KEY_VALUE.test(entry) || AUTHENTICATED_URL.test(entry))
    ) {
      throw new ConfigSecurityError(`${entryPath.join(".")} looks like inline credential material`);
    }
    rejectInlineSecrets(entry, entryPath);
  }
}

export class ConfigSecurityError extends Error {
  override readonly name = "ConfigSecurityError";
}

export function parseAnyxConfig(input: unknown): AnyxConfig {
  rejectInlineSecrets(input);
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return anyxConfigSchema.parse(input);
  }
  const candidate = structuredClone(input) as Record<string, unknown>;
  const environment = candidate.environment;
  if (
    (environment === "local" ||
      environment === "test" ||
      environment === "staging" ||
      environment === "production") &&
    candidate.payments !== null &&
    typeof candidate.payments === "object" &&
    !Array.isArray(candidate.payments)
  ) {
    const payments = candidate.payments as Record<string, unknown>;
    payments.feeBps ??=
      environment === "production" ? PRODUCTION_FEE_BPS : LOCAL_TEST_FEE_BPS;
    payments.maxFeeBps ??= 100;
    payments.collectFeeOnchain ??= false;
  }
  return anyxConfigSchema.parse(candidate);
}

export { secretReferenceSchema };
