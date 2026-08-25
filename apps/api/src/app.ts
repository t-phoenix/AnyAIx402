import type { AnyxConfig } from "@anyx/config";
import { getConfigStatus, publicStatusPayload } from "@anyx/config";
import { AnyxError } from "@anyx/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { registerRoutes } from "./routes/index.ts";
import { SETUP_HTML } from "./setup-html.ts";

export type ApiEnv = {
  Variables: {
    config: AnyxConfig;
    requestId: string;
  };
};

export function createApp(config: AnyxConfig) {
  const app = new Hono<ApiEnv>();

  app.use("*", async (c, next) => {
    const requestId = c.req.header("X-Request-ID") ?? crypto.randomUUID();
    c.header("X-Request-ID", requestId);
    c.set("requestId", requestId);
    c.set("config", config);
    await next();
  });

  app.use("*", cors());
  app.use("*", logger());

  app.get("/", (c) =>
    c.json({
      name: "AnyX",
      tagline: "Pay with any token. Settle on x402.",
      docs: "/setup",
      health: "/health",
      openapi: "/openapi.json",
    }),
  );

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      stubPayments: config.stubPayments,
    }),
  );

  app.get("/setup", (c) => c.html(SETUP_HTML));
  app.get("/dashboard", (c) => c.redirect("/setup"));

  app.get("/v1/config/status", (c) => {
    const status = getConfigStatus(c.get("config"));
    return c.json(publicStatusPayload(status));
  });

  registerRoutes(app);

  app.notFound((c) =>
    c.json(
      { error: { code: "INVALID_INPUT", message: `No route ${c.req.method} ${c.req.path}` } },
      404,
    ),
  );

  app.onError((err, c) => {
    if (err instanceof AnyxError) {
      const status =
        err.code === "QUOTE_NOT_FOUND" || err.code === "ENDPOINT_NOT_X402"
          ? 404
          : err.code === "RATE_LIMITED"
            ? 429
            : err.code === "QUOTE_EXPIRED"
              ? 422
              : 400;
      return c.json(err.toJSON(), status);
    }
    return c.json({ error: { code: "INVALID_INPUT", message: err.message } }, 500);
  });

  return app;
}
