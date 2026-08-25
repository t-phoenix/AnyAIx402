import { loadConfig } from "@anyx/config";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";

const config = loadConfig();
const app = createApp(config);
const port = config.port;

serve({ fetch: app.fetch, port }, () => {
  console.log(`AnyX API http://localhost:${port}`);
  console.log(`Config wizard http://localhost:${port}/setup`);
  console.log(`Stub payments: ${config.stubPayments}`);
});
