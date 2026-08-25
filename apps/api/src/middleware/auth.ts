import type { MiddlewareHandler } from "hono";

export const requestId: MiddlewareHandler = async (c, next) => {
  c.header("X-Request-ID", c.req.header("X-Request-ID") ?? crypto.randomUUID());
  await next();
};
