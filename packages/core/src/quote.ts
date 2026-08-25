import { randomUUID } from "node:crypto";
import type { AnyxConfig } from "@anyx/config";
import { feeBpsForToken, feeUsdc, grossUsdcForFee } from "./fees.ts";
import { getToken } from "./tokens.ts";
import { AnyxError, type BestQuote, type DEXQuote, type Token } from "./types.ts";
import { fetch402Challenge, selectBaseUsdcOption, usdcRequiredFromAmount } from "./x402.ts";

export type QuoteParams = {
  inputToken: Token;
  usdcRequired: string;
  chainId: number;
  slippageBps?: number;
};

const STUB_USD_PRICES: Record<string, number> = {
  ETH: 2365.42,
  WETH: 2365.42,
  USDT: 1,
  USDC: 1,
  WBTC: 65000,
  cbBTC: 65000,
  BTC: 65000,
  SOL: 140,
};

export async function get1inchQuote(
  params: QuoteParams,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<DEXQuote> {
  if (!apiKey) throw new AnyxError("NO_ROUTE", "1inch API key not configured");
  const url = new URL(`https://api.1inch.dev/swap/v6.0/${params.chainId}/quote`);
  url.searchParams.set(
    "src",
    params.inputToken.address ?? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  );
  url.searchParams.set("dst", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  url.searchParams.set("amount", params.usdcRequired);
  url.searchParams.set("includeProtocols", "true");
  url.searchParams.set("includeGas", "true");
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new AnyxError("SWAP_FAILED", `1inch quote failed (${res.status})`);
  const data = (await res.json()) as { dstAmount?: string; gas?: number };
  return {
    source: "1inch",
    amountOut: data.dstAmount ?? params.usdcRequired,
    estimatedGas: data.gas ? String(data.gas) : undefined,
    priceImpact: "0",
  };
}

export async function get0xQuote(
  params: QuoteParams,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<DEXQuote> {
  if (!apiKey) throw new AnyxError("NO_ROUTE", "0x API key not configured");
  const url = new URL("https://api.0x.org/swap/permit2/quote");
  url.searchParams.set(
    "sellToken",
    params.inputToken.address ?? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  );
  url.searchParams.set("buyToken", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  url.searchParams.set("sellAmount", params.usdcRequired);
  const res = await fetchImpl(url, {
    headers: { "0x-api-key": apiKey, "0x-chain-id": String(params.chainId) },
  });
  if (!res.ok) throw new AnyxError("SWAP_FAILED", `0x quote failed (${res.status})`);
  const data = (await res.json()) as { buyAmount?: string };
  return {
    source: "0x",
    amountOut: data.buyAmount ?? params.usdcRequired,
    priceImpact: "0",
  };
}

export function stubDexQuote(params: QuoteParams): DEXQuote {
  const gross = grossUsdcForFee(Number(params.usdcRequired), feeBpsForToken(params.inputToken));
  return {
    source: "stub",
    amountOut: String(Math.round(gross * 1e6)),
    priceImpact: "0.0008",
  };
}

export async function getBestQuote(
  params: QuoteParams,
  config: Pick<AnyxConfig, "oneInchApiKey" | "zeroXApiKey" | "feeBps">,
  fetchImpl: typeof fetch = fetch,
): Promise<{ dex: DEXQuote; feeBps: number; grossUsdc: number; fee: number }> {
  const feeBps = feeBpsForToken(params.inputToken, config.feeBps);
  const usdcRequired = Number(params.usdcRequired);
  const grossUsdc = grossUsdcForFee(usdcRequired, feeBps);
  const fee = feeUsdc(usdcRequired, feeBps);

  const jobs: Promise<DEXQuote>[] = [];
  if (config.oneInchApiKey) {
    jobs.push(get1inchQuote(params, config.oneInchApiKey, fetchImpl));
  }
  if (config.zeroXApiKey) {
    jobs.push(get0xQuote(params, config.zeroXApiKey, fetchImpl));
  }

  if (jobs.length === 0) {
    return { dex: stubDexQuote(params), feeBps, grossUsdc, fee };
  }

  const settled = await Promise.allSettled(jobs);
  const ok = settled
    .filter((r): r is PromiseFulfilledResult<DEXQuote> => r.status === "fulfilled")
    .map((r) => r.value);
  if (ok.length === 0) {
    throw new AnyxError("SWAP_FAILED", "1inch and 0x both failed to return a quote");
  }
  ok.sort((a, b) => Number(b.amountOut) - Number(a.amountOut));
  return { dex: ok[0], feeBps, grossUsdc, fee };
}

export async function quoteForEndpoint(args: {
  endpointUrl: string;
  inputToken: string;
  inputChainId: number;
  slippageBps?: number;
  config: AnyxConfig;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<BestQuote> {
  const token = getToken(args.inputToken, args.inputChainId);
  if (!token) {
    throw new AnyxError(
      "INVALID_INPUT",
      `Token ${args.inputToken} on chain ${args.inputChainId} is not in the AnyX registry`,
    );
  }
  if (token.swapPath !== "direct") {
    throw new AnyxError(
      "NO_ROUTE",
      `${token.symbol} on chain ${token.chainId} is Phase 2/3. v0 supports Base tokens only.`,
    );
  }

  const fetchImpl = args.fetchImpl ?? fetch;
  const challenge = await fetch402Challenge(args.endpointUrl, fetchImpl);
  if (!challenge) {
    throw new AnyxError("ENDPOINT_NOT_X402", "The URL did not return HTTP 402 Payment Required");
  }
  const option = selectBaseUsdcOption(challenge);
  const usdcRequired = usdcRequiredFromAmount(option.amount);

  const best = await getBestQuote(
    {
      inputToken: token,
      usdcRequired: String(usdcRequired),
      chainId: args.inputChainId,
      slippageBps: args.slippageBps,
    },
    args.config,
    fetchImpl,
  );

  const usdPrice = STUB_USD_PRICES[token.symbol] ?? 1;
  const inputAmount =
    token.symbol === "USDT" || token.symbol === "USDC" ? best.grossUsdc : best.grossUsdc / usdPrice;

  const expires = new Date((args.now ?? new Date()).getTime() + 30_000);

  return {
    quoteId: randomUUID(),
    inputToken: token,
    inputAmount: inputAmount.toFixed(token.decimals === 18 ? 8 : 6),
    inputAmountUsd: best.grossUsdc.toFixed(6),
    usdcRequired: usdcRequired.toFixed(6),
    fee: best.fee.toFixed(6),
    feeBps: best.feeBps,
    route: { dex: best.dex.source, priceImpact: best.dex.priceImpact ?? "0" },
    expiresAt: expires,
    usdcOnChain: "eip155:8453",
    endpointUrl: args.endpointUrl,
    payTo: option.payTo,
    usdcAmountAtomic: option.amount,
  };
}

export { STUB_USD_PRICES };
