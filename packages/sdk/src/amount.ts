export interface FeePolicy {
  feeBps: number;
  maxFeeBps: number;
}

export interface FeeBreakdown {
  apiCostAtomic: bigint;
  grossAtomic: bigint;
  feeAtomic: bigint;
  feeBps: number;
  rounding: "ceil";
  collection: "disclosure-only";
}

export const PRODUCTION_FEE_BPS = 20;
export const LOCAL_TEST_FEE_BPS = 0;

export function parseAtomicAmount(value: string): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new TypeError(`Atomic amount must be a canonical unsigned integer: ${value}`);
  }
  return BigInt(value);
}

function assertBasisPoints(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value >= 10_000) {
    throw new RangeError(`${name} must be an integer from 0 through 9999`);
  }
}

export function calculateFeeOnTop(apiCost: bigint, policy: FeePolicy): FeeBreakdown {
  if (apiCost < 0n) {
    throw new RangeError("apiCost cannot be negative");
  }
  assertBasisPoints(policy.feeBps, "feeBps");
  assertBasisPoints(policy.maxFeeBps, "maxFeeBps");
  if (policy.feeBps > policy.maxFeeBps) {
    throw new RangeError(`feeBps ${policy.feeBps} exceeds configured cap ${policy.maxFeeBps}`);
  }

  const denominator = 10_000n - BigInt(policy.feeBps);
  const numerator = apiCost * 10_000n;
  const grossAtomic = numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;

  return {
    apiCostAtomic: apiCost,
    grossAtomic,
    feeAtomic: grossAtomic - apiCost,
    feeBps: policy.feeBps,
    rounding: "ceil",
    collection: "disclosure-only",
  };
}
