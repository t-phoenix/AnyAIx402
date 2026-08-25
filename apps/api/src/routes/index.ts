import type { Hono } from "hono";
import type { ApiEnv } from "../app.ts";
import { quoteForEndpoint, saveQuote, v0Tokens, STUB_USD_PRICES } from "@anyx/core";
import { executePay, getReceipt } from "@anyx/core";

function serializeQuote(quote: Awaited<ReturnType<typeof quoteForEndpoint>>) {
  return {
    quoteId: quote.quoteId,
    inputToken: quote.inputToken.symbol,
    inputAmount: quote.inputAmount,
    inputAmountUSD: quote.inputAmountUsd,
    usdcRequired: quote.usdcRequired,
    fee: quote.fee,
    feeBps: quote.feeBps,
    route: quote.route,
    expiresAt: quote.expiresAt.toISOString(),
    payTo: quote.payTo,
  };
}

export function registerRoutes(app: Hono<ApiEnv>) {
  app.get("/v1/tokens", (c) => {
    const tokens = v0Tokens().map((t) => ({
      ...t,
      usdPrice: String(STUB_USD_PRICES[t.symbol] ?? "1"),
    }));
    return c.json({ tokens, updatedAt: new Date().toISOString() });
  });

  app.post("/v1/quote", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const endpointUrl = String(body.endpointUrl ?? "");
    const inputToken = String(body.inputToken ?? "");
    const inputChainId = Number(body.inputChainId);
    if (!endpointUrl || !inputToken || !Number.isFinite(inputChainId)) {
      return c.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Body must include endpointUrl, inputToken, and inputChainId",
          },
        },
        400,
      );
    }
    const quote = await quoteForEndpoint({
      endpointUrl,
      inputToken,
      inputChainId,
      slippageBps: body.slippageBps,
      config: c.get("config"),
    });
    saveQuote(quote);
    return c.json(serializeQuote(quote));
  });

  app.post("/v1/pay", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const quoteId = String(body.quoteId ?? "");
    const walletAddress = String(body.walletAddress ?? "");
    if (!quoteId || !walletAddress) {
      return c.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Body must include quoteId and walletAddress",
          },
        },
        400,
      );
    }
    const receipt = await executePay({
      quoteId,
      walletAddress,
      config: c.get("config"),
    });
    return c.json(receipt);
  });

  app.get("/v1/receipt/:id", (c) => {
    return c.json(getReceipt(c.req.param("id")));
  });

  app.post("/v1/lightning/invoice", (c) =>
    c.json({
      invoice: "not_implemented",
      message: "Lightning coming in Phase 3 (see docs/PLAN.md)",
    }),
  );

  app.get("/v1/lightning/status/:paymentHash", (c) =>
    c.json({
      status: "pending",
      paymentHash: c.req.param("paymentHash"),
      message: "Lightning coming in Phase 3",
    }),
  );
}
